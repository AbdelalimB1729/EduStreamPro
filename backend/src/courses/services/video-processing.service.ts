import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ffmpeg from 'fluent-ffmpeg';
import * as crypto from 'crypto';
import { S3Adapter } from '../../shared/storage/s3-adapter';
import { VideoMetadataUtil } from '../../shared/utils/video-metadata.util';
import { SEAL } from 'node-seal';
import { createHash } from 'crypto';

@Injectable()
export class VideoProcessingService {
  private readonly logger = new Logger(VideoProcessingService.name);
  private readonly qualities = ['1080p', '720p', '480p', '360p'];

  private seal: any;
  private encryptor: any;
  private evaluator: any;
  private encoder: any;
  private context: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly s3Adapter: S3Adapter,
    private readonly videoMetadataUtil: VideoMetadataUtil,
  ) {
    this.initializeHomomorphicEncryption();
  }

  private async initializeHomomorphicEncryption() {
    try {
      this.seal = await SEAL();
      
      // Initialize encryption parameters
      const schemeType = this.seal.SchemeType.bfv;
      const securityLevel = this.seal.SecurityLevel.tc128;
      const polyModulusDegree = 4096;
      const coeffModulus = this.seal.CoeffModulus.BFVDefault(polyModulusDegree);
      const plainModulus = this.seal.PlainModulus.Batching(polyModulusDegree, 20);

      const encParams = this.seal.EncryptionParameters(schemeType);
      encParams.setPolyModulusDegree(polyModulusDegree);
      encParams.setCoeffModulus(coeffModulus);
      encParams.setPlainModulus(plainModulus);

      // Generate context
      this.context = this.seal.Context(
        encParams,
        true,
        securityLevel,
      );

      // Create encryption tools
      const keyGenerator = this.seal.KeyGenerator(this.context);
      const publicKey = keyGenerator.createPublicKey();
      const secretKey = keyGenerator.secretKey();
      const relinKeys = keyGenerator.createRelinKeys();

      this.encryptor = this.seal.Encryptor(this.context, publicKey);
      this.evaluator = this.seal.Evaluator(this.context);
      this.encoder = this.seal.BatchEncoder(this.context);

      // Store keys securely
      const keyHash = createHash('sha256')
        .update(secretKey.save())
        .digest('hex');
      
      await this.s3Adapter.uploadBuffer(
        Buffer.from(keyHash),
        'encryption/master-key.hash',
      );
    } catch (error) {
      this.logger.error('Failed to initialize homomorphic encryption:', error);
      throw error;
    }
  }

  async processVideo(videoBuffer: Buffer, filename: string): Promise<string[]> {
    const encryptionKey = crypto.randomBytes(16).toString('hex');
    const variants: string[] = [];

    try {
      // Extract metadata
      const metadata = await this.videoMetadataUtil.extractMetadata(videoBuffer);
      
      // Process each quality variant
      for (const quality of this.qualities) {
        const variantKey = `${filename}-${quality}`;
        const hlsSegments = await this.transcodeToHLS(
          videoBuffer,
          quality,
          encryptionKey,
        );

        // Upload segments to S3
        const urls = await Promise.all(
          hlsSegments.map((segment) =>
            this.s3Adapter.uploadBuffer(segment.buffer, `${variantKey}/${segment.name}`),
          ),
        );

        variants.push(...urls);
      }

      return variants;
    } catch (error) {
      this.logger.error(`Error processing video: ${error.message}`);
      throw error;
    }
  }

  private async transcodeToHLS(
    videoBuffer: Buffer,
    quality: string,
    encryptionKey: string,
  ): Promise<Array<{ buffer: Buffer; name: string }>> {
    return new Promise((resolve, reject) => {
      const segments: Array<{ buffer: Buffer; name: string }> = [];
      const resolution = this.getResolutionForQuality(quality);

      ffmpeg()
        .input(videoBuffer)
        .outputOptions([
          '-c:v h264',
          '-c:a aac',
          `-vf scale=${resolution}`,
          '-f hls',
          '-hls_time 6',
          '-hls_list_size 0',
          '-hls_segment_type mpegts',
          '-hls_key_info_file key.info',
          '-hls_enc 1',
        ])
        .on('end', async () => {
          try {
            // Apply homomorphic encryption to each segment
            const encryptedSegments = await Promise.all(
              segments.map(async (segment) => {
                // Convert video segment to numeric array for homomorphic operations
                const data = new Uint8Array(segment.buffer);
                const values = Array.from(data);
                
                // Encode and encrypt segment data
                const plaintext = this.encoder.encode(values);
                const ciphertext = this.encryptor.encrypt(plaintext);

                // Apply homomorphic transformations for DRM
                const rotatedCipher = this.evaluator.rotate(
                  ciphertext,
                  1,
                  this.evaluator.relinKeys,
                );
                const multipliedCipher = this.evaluator.multiply(
                  ciphertext,
                  rotatedCipher,
                  this.evaluator.relinKeys,
                );

                // Convert back to buffer
                return {
                  buffer: Buffer.from(multipliedCipher.save()),
                  name: segment.name,
                  metadata: {
                    homomorphic: true,
                    transformType: 'rotate-multiply',
                    version: '1.0',
                  },
                };
              }),
            );

            resolve(encryptedSegments);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (err) => reject(err))
        .on('progress', (progress) => {
          this.logger.debug(`Processing: ${progress.percent}% done`);
        })
        .toFormat('hls')
        .pipe()
        .on('data', (chunk) => {
          segments.push({
            buffer: chunk,
            name: `segment_${segments.length}.ts`,
          });
        });
    });
  }

  private getResolutionForQuality(quality: string): string {
    const resolutions = {
      '1080p': '1920x1080',
      '720p': '1280x720',
      '480p': '854x480',
      '360p': '640x360',
    };
    return resolutions[quality] || '1280x720';
  }
}