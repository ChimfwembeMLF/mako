import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { basename, extname, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { GeneratorProvider } from '../../common/generator.provider';

export interface StorageUploadResult {
  publicUrl: string;
  storagePath: string;
}

@Injectable()
export class S3StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private client: S3Client | null = null;

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    const bucket = this.config.get<string>('AWS_S3_BUCKET_NAME')?.trim();
    const region = this.config.get<string>('AWS_S3_BUCKET_NAME_REGION')?.trim();
    const key = this.config.get<string>('AWS_ACCESS_KEY_ID')?.trim();
    return Boolean(bucket && region && key);
  }

  assertConfigured(): void {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException(
        'S3 storage is required. Set AWS_S3_BUCKET_NAME, AWS_S3_BUCKET_NAME_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY in .env',
      );
    }
  }

  get bucket(): string {
    return this.config.get<string>('AWS_S3_BUCKET_NAME')!.trim();
  }

  isS3Url(url: string): boolean {
    if (!url) return false;
    try {
      GeneratorProvider.getS3Key(url);
      return true;
    } catch {
      return false;
    }
  }

  private getClient(): S3Client {
    this.assertConfigured();
    if (this.client) return this.client;
    
    const region = this.config.get<string>('AWS_S3_BUCKET_NAME_REGION')!.trim();
    const endpoint = this.config.get<string>('AWS_S3_ENDPOINT')?.trim();
    
    this.client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle: !!endpoint, // Usually true for S3 compatible endpoints
      credentials: {
        accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID')!.trim(),
        secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY')!.trim(),
      },
    });
    
    return this.client;
  }

  buildObjectPath(params: {
    tenantId: string;
    prefix?: string;
    ext: string;
  }): string {
    const safeTenant = params.tenantId.replace(/[^a-zA-Z0-9-]/g, '');
    const folder = params.prefix ?? 'uploads';
    return `${safeTenant}/${folder}/${GeneratorProvider.fileName(params.ext.replace(/^\./, ''))}`;
  }

  async uploadBuffer(params: {
    tenantId: string;
    buffer: Buffer;
    contentType: string;
    originalName?: string;
    prefix?: string;
  }): Promise<StorageUploadResult> {
    const ext =
      extname(params.originalName ?? '') ||
      (params.contentType.startsWith('video/') ? '.mp4' : '.bin');
    const storagePath = this.buildObjectPath({
      tenantId: params.tenantId,
      prefix: params.prefix,
      ext,
    });

    const client = this.getClient();
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: storagePath,
          Body: params.buffer,
          ContentType: params.contentType,
          CacheControl: 'max-age=3600',
        })
      );
      
      const publicUrl = GeneratorProvider.getS3PublicUrl(storagePath);
      return { publicUrl, storagePath };
    } catch (error: any) {
      this.logger.error(`S3 upload failed: ${error.message}`);
      throw new BadRequestException(`Storage upload failed: ${error.message}`);
    }
  }

  async ensureS3Url(
    url: string,
    tenantId: string,
    prefix = 'uploads',
  ): Promise<string> {
    if (!url?.trim()) return url;
    if (this.isS3Url(url)) return url;

    const localPath = this.localFilePath(url);
    if (!localPath || !existsSync(localPath)) {
      throw new BadRequestException(
        `Media URL is not in S3 storage: ${basename(
          url,
        )}. Re-upload the file from the Media Library.`,
      );
    }

    const ext = extname(localPath).toLowerCase();
    const contentType =
      ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.gif'
        ? 'image/gif'
        : ext === '.webp'
        ? 'image/webp'
        : ext === '.mp4'
        ? 'video/mp4'
        : 'application/octet-stream';

    const uploaded = await this.uploadBuffer({
      tenantId,
      buffer: readFileSync(localPath),
      contentType,
      originalName: basename(localPath),
      prefix,
    });

    this.logger.log(`Migrated legacy file to S3: ${basename(localPath)}`);
    return uploaded.publicUrl;
  }

  readLocalUpload(
    url: string,
  ): { buffer: Buffer; contentType: string; filename: string } | null {
    const localPath = this.localFilePath(url);
    if (!localPath || !existsSync(localPath)) return null;
    const ext = extname(localPath).toLowerCase();
    const contentType =
      ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.mp4'
        ? 'video/mp4'
        : 'application/octet-stream';
    return {
      buffer: readFileSync(localPath),
      contentType,
      filename: basename(localPath),
    };
  }

  localFilePath(url: string): string | null {
    let pathname = url;
    try {
      if (/^https?:\/\//i.test(url)) {
        pathname = new URL(url).pathname;
      }
    } catch {
      // keep as-is
    }
    if (!pathname.startsWith('/uploads/')) return null;
    return join(process.cwd(), pathname.replace(/^\//, ''));
  }

  pathFromPublicUrl(publicUrl: string): string | null {
    if (!publicUrl) return null;
    try {
      return GeneratorProvider.getS3Key(publicUrl);
    } catch {
      return null;
    }
  }

  async deleteByUrl(publicUrl: string): Promise<void> {
    if (!this.isS3Url(publicUrl)) return;
    const path = this.pathFromPublicUrl(publicUrl);
    if (!path) return;
    await this.deleteByPath(path);
  }

  async deleteByPath(storagePath: string): Promise<void> {
    const client = this.getClient();
    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: storagePath,
        })
      );
    } catch (error: any) {
      this.logger.warn(
        `S3 delete failed for ${storagePath}: ${error.message}`,
      );
    }
  }

  async downloadBuffer(storagePath: string): Promise<Buffer> {
    const client = this.getClient();
    try {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: storagePath,
        })
      );
      
      const stream = response.Body as NodeJS.ReadableStream;
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } catch (error: any) {
      throw new BadRequestException(
        `Storage download failed: ${error?.message ?? 'empty response'}`,
      );
    }
  }
}
