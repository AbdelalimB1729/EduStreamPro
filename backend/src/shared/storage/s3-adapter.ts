import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import * as crypto from 'crypto';
import { create, IPFSHTTPClient } from 'ipfs-http-client';
import { Web3Storage, File } from 'web3.storage';
import { ethers } from 'ethers';
import { Buffer } from 'buffer';

@Injectable()
export class S3Adapter {
  private readonly s3: AWS.S3;
  private readonly bucketName: string;
  private readonly ipfs: IPFSHTTPClient;
  private readonly web3Storage: Web3Storage;
  private readonly provider: ethers.providers.JsonRpcProvider;
  private readonly contract: ethers.Contract;

  constructor(private readonly configService: ConfigService) {
    AWS.config.update({
      accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      region: this.configService.get('AWS_REGION'),
    });

    this.s3 = new AWS.S3();
    this.bucketName = this.configService.get('AWS_BUCKET_NAME');

    this.ipfs = create({
      host: this.configService.get('IPFS_HOST'),
      port: this.configService.get('IPFS_PORT'),
      protocol: this.configService.get('IPFS_PROTOCOL'),
    });

    this.web3Storage = new Web3Storage({
      token: this.configService.get('WEB3_STORAGE_TOKEN'),
    });

    this.provider = new ethers.providers.JsonRpcProvider(
      this.configService.get('ETH_RPC_URL'),
    );

    const contractAddress = this.configService.get('CREDENTIAL_CONTRACT_ADDRESS');
    const contractABI = [
      'function mintCredential(address recipient, string tokenURI) public',
      'function verifyCredential(uint256 tokenId) public view returns (bool)',
      'function getCredentialMetadata(uint256 tokenId) public view returns (string)',
    ];

    const wallet = new ethers.Wallet(
      this.configService.get('ETH_PRIVATE_KEY'),
      this.provider,
    );

    this.contract = new ethers.Contract(
      contractAddress,
      contractABI,
      wallet,
    );
  }

  async uploadBuffer(buffer: Buffer, key: string, useIPFS = false): Promise<string> {
    if (useIPFS) {
      const result = await this.ipfs.add(buffer);
      const cid = result.cid.toString();

      const files = [
        new File([buffer], key, {
          type: this.getContentType(key),
        }),
      ];
      await this.web3Storage.put(files);

      return `ipfs://${cid}`;
    } else {
      const params = {
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: this.getContentType(key),
        ServerSideEncryption: 'AES256',
      };

      const result = await this.s3.upload(params).promise();
      return result.Location;
    }
  }

  async mintCredential(
    recipientAddress: string,
    metadata: any,
  ): Promise<{ tokenId: string; transactionHash: string }> {
    try {
      const metadataBuffer = Buffer.from(JSON.stringify(metadata));
      const ipfsPath = await this.uploadBuffer(metadataBuffer, 'metadata.json', true);

      const transaction = await this.contract.mintCredential(
        recipientAddress,
        ipfsPath,
      );
      const receipt = await transaction.wait();

      const event = receipt.events.find(e => e.event === 'CredentialMinted');
      const tokenId = event.args.tokenId.toString();

      return {
        tokenId,
        transactionHash: receipt.transactionHash,
      };
    } catch (error) {
      console.error('Failed to mint credential:', error);
      throw error;
    }
  }

  async verifyCredential(tokenId: string): Promise<{
    isValid: boolean;
    metadata?: any;
  }> {
    try {
      const isValid = await this.contract.verifyCredential(tokenId);
      if (!isValid) {
        return { isValid: false };
      }

      const metadataURI = await this.contract.getCredentialMetadata(tokenId);
      if (!metadataURI.startsWith('ipfs://')) {
        return { isValid: false };
      }
      const cid = metadataURI.replace('ipfs://', '');
      const chunks = [];
      for await (const chunk of this.ipfs.cat(cid)) {
        chunks.push(chunk);
      }
      const metadata = JSON.parse(Buffer.concat(chunks).toString());

      return {
        isValid: true,
        metadata,
      };
    } catch (error) {
      console.error('Failed to verify credential:', error);
      return { isValid: false };
    }
  }

  async uploadTranscript(
    userId: string,
    transcript: any,
  ): Promise<{ cid: string; url: string }> {
    try {
      const transcriptData = {
        userId,
        transcript,
        timestamp: Date.now(),
        signature: this.signTranscript(transcript),
      };

      const buffer = Buffer.from(JSON.stringify(transcriptData));
      const result = await this.ipfs.add(buffer);
      const cid = result.cid.toString();
      const files = [
        new File([buffer], 'transcript.json', {
          type: 'application/json',
        }),
      ];
      await this.web3Storage.put(files);

      return {
        cid,
        url: `ipfs://${cid}`,
      };
    } catch (error) {
      console.error('Failed to upload transcript:', error);
      throw error;
    }
  }

  private signTranscript(transcript: any): string {
    const message = JSON.stringify(transcript);
    const privateKey = this.configService.get('TRANSCRIPT_SIGNING_KEY');
    
    const signer = crypto.createSign('SHA256');
    signer.update(message);
    return signer.sign(privateKey, 'base64');
  }

  async uploadChunkedFile(
    chunks: Buffer[],
    key: string,
    metadata?: Record<string, string>,
  ): Promise<string> {
    // Initialize multipart upload
    const initParams = {
      Bucket: this.bucketName,
      Key: key,
      ContentType: this.getContentType(key),
      Metadata: metadata,
      ServerSideEncryption: 'AES256',
    };

    const multipartUpload = await this.s3.createMultipartUpload(initParams).promise();
    const uploadId = multipartUpload.UploadId;

    try {
      // Upload parts
      const partPromises = chunks.map((chunk, index) =>
        this.uploadPart(chunk, index + 1, uploadId, key),
      );
      const parts = await Promise.all(partPromises);

      // Complete multipart upload
      const completeParams = {
        Bucket: this.bucketName,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((etag, index) => ({
            ETag: etag,
            PartNumber: index + 1,
          })),
        },
      };

      const result = await this.s3.completeMultipartUpload(completeParams).promise();
      return result.Location;
    } catch (error) {
      // Abort multipart upload on error
      await this.s3
        .abortMultipartUpload({
          Bucket: this.bucketName,
          Key: key,
          UploadId: uploadId,
        })
        .promise();
      throw error;
    }
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const params = {
      Bucket: this.bucketName,
      Key: key,
      Expires: expiresIn,
    };

    return this.s3.getSignedUrlPromise('getObject', params);
  }

  async deleteFile(key: string): Promise<void> {
    const params = {
      Bucket: this.bucketName,
      Key: key,
    };

    await this.s3.deleteObject(params).promise();
  }

  async encryptFile(buffer: Buffer, key: string): Promise<Buffer> {
    const cipher = crypto.createCipher('aes-256-cbc', key);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    return encrypted;
  }

  async decryptFile(buffer: Buffer, key: string): Promise<Buffer> {
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    const decrypted = Buffer.concat([decipher.update(buffer), decipher.final()]);
    return decrypted;
  }

  private async uploadPart(
    chunk: Buffer,
    partNumber: number,
    uploadId: string,
    key: string,
  ): Promise<string> {
    const params = {
      Bucket: this.bucketName,
      Key: key,
      PartNumber: partNumber,
      UploadId: uploadId,
      Body: chunk,
    };

    const result = await this.s3.uploadPart(params).promise();
    return result.ETag;
  }

  private getContentType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    const contentTypes = {
      mp4: 'video/mp4',
      m3u8: 'application/x-mpegURL',
      ts: 'video/MP2T',
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };

    return contentTypes[extension] || 'application/octet-stream';
  }
}