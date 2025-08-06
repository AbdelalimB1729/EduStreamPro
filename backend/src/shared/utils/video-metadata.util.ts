import { Injectable } from '@nestjs/common';
import * as ffmpeg from 'fluent-ffmpeg';

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  bitrate: number;
  format: string;
  codec: string;
  fps: number;
  size: number;
}

@Injectable()
export class VideoMetadataUtil {
  async extractMetadata(buffer: Buffer): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(buffer, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        resolve({
          duration: metadata.format.duration,
          width: videoStream.width,
          height: videoStream.height,
          bitrate: metadata.format.bit_rate,
          format: metadata.format.format_name,
          codec: videoStream.codec_name,
          fps: eval(videoStream.r_frame_rate),
          size: metadata.format.size,
        });
      });
    });
  }

  async generateThumbnail(buffer: Buffer, time = '00:00:01'): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      let thumbnailBuffer = Buffer.alloc(0);

      ffmpeg(buffer)
        .screenshots({
          timestamps: [time],
          filename: 'thumbnail.jpg',
          size: '320x240',
        })
        .on('end', () => resolve(thumbnailBuffer))
        .on('error', (err) => reject(err))
        .pipe()
        .on('data', (chunk) => {
          thumbnailBuffer = Buffer.concat([thumbnailBuffer, chunk]);
        });
    });
  }

  async generateWaveform(buffer: Buffer): Promise<number[]> {
    return new Promise((resolve, reject) => {
      const waveform: number[] = [];

      ffmpeg(buffer)
        .toFormat('wav')
        .on('error', (err) => reject(err))
        .pipe()
        .on('data', (chunk) => {
          // Process audio data to generate waveform
          // This is a simplified version - in reality, you'd want to use
          // a proper audio processing library
          for (let i = 0; i < chunk.length; i += 2) {
            const sample = chunk.readInt16LE(i) / 32768.0;
            waveform.push(Math.abs(sample));
          }
        })
        .on('end', () => {
          // Normalize and reduce waveform points
          const normalized = this.normalizeWaveform(waveform, 100);
          resolve(normalized);
        });
    });
  }

  private normalizeWaveform(waveform: number[], points: number): number[] {
    const blockSize = Math.floor(waveform.length / points);
    const normalized = [];

    for (let i = 0; i < points; i++) {
      const start = i * blockSize;
      const end = start + blockSize;
      const block = waveform.slice(start, end);
      const average = block.reduce((a, b) => a + b, 0) / block.length;
      normalized.push(average);
    }

    const max = Math.max(...normalized);
    return normalized.map(n => n / max);
  }

  async checkVideoIntegrity(buffer: Buffer): Promise<boolean> {
    return new Promise((resolve) => {
      ffmpeg(buffer)
        .on('end', () => resolve(true))
        .on('error', () => resolve(false))
        .pipe();
    });
  }

  async getKeyframes(buffer: Buffer): Promise<number[]> {
    return new Promise((resolve, reject) => {
      const keyframes: number[] = [];

      ffmpeg(buffer)
        .outputOptions(['-skip_frame nokey', '-select_streams v', '-show_entries frame=pkt_pts_time'])
        .format('framemd5')
        .on('error', (err) => reject(err))
        .pipe()
        .on('data', (chunk) => {
          const data = chunk.toString();
          const match = data.match(/pts_time:(\d+\.\d+)/);
          if (match) {
            keyframes.push(parseFloat(match[1]));
          }
        })
        .on('end', () => resolve(keyframes));
    });
  }
}