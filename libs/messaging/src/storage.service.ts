import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import * as Minio from 'minio';

@Injectable()
export class StorageService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client | null = null;
  private readonly bucket: string;
  private readonly enabled: boolean;

  constructor() {
    this.bucket = process.env['MINIO_BUCKET'] ?? 'kairosis';
    this.enabled = !!process.env['MINIO_ENDPOINT'];
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.enabled) {
      this.logger.log('MINIO_ENDPOINT not set — claim-check storage disabled');
      return;
    }

    this.client = new Minio.Client({
      endPoint: process.env['MINIO_ENDPOINT']!,
      port: parseInt(process.env['MINIO_PORT'] ?? '9100'),
      useSSL: process.env['MINIO_USE_SSL'] === 'true',
      accessKey: process.env['MINIO_ACCESS_KEY'] ?? '',
      secretKey: process.env['MINIO_SECRET_KEY'] ?? '',
    });

    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Created MinIO bucket: ${this.bucket}`);
      }
      this.logger.log(`Connected to MinIO — bucket: ${this.bucket}`);
    } catch (err) {
      this.logger.error('Failed to connect to MinIO — crashing', err);
      process.exit(1);
    }
  }

  isEnabled(): boolean {
    return this.enabled && this.client !== null;
  }

  async upload(objectKey: string, data: string): Promise<void> {
    if (!this.client) throw new Error('StorageService not initialized');
    const buf = Buffer.from(data, 'utf8');
    await this.client.putObject(this.bucket, objectKey, buf, buf.length, {
      'Content-Type': 'application/json',
    });
  }

  async presignedGetUrl(objectKey: string, expirySeconds: number): Promise<string> {
    if (!this.client) throw new Error('StorageService not initialized');
    return this.client.presignedGetObject(this.bucket, objectKey, expirySeconds);
  }
}
