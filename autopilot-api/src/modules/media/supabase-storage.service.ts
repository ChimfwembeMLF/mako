import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { WebSocket as NodeWebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { basename, extname, join } from 'path';
import { existsSync, readFileSync } from 'fs';

export interface StorageUploadResult {
  publicUrl: string;
  storagePath: string;
}

@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private client: SupabaseClient | null = null;

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    const url = this.config.get<string>('SUPABASE_URL')?.trim();
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')?.trim();
    return Boolean(url && key);
  }

  /** All media uploads require Supabase — call at the start of upload flows. */
  assertConfigured(): void {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException(
        'Supabase storage is required. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env',
      );
    }
  }

  get bucket(): string {
    return this.config.get<string>('SUPABASE_STORAGE_BUCKET')?.trim() || 'media';
  }

  isSupabaseUrl(url: string): boolean {
    if (!url) return false;
    const base = this.config.get<string>('SUPABASE_URL')?.trim().replace(/\/$/, '');
    if (base && url.startsWith(base)) return true;
    return /supabase\.co\/storage\/v1\/object\//.test(url);
  }

  private getClient(): SupabaseClient {
    this.assertConfigured();
    if (this.client) return this.client;
    const url = this.config.get<string>('SUPABASE_URL')!.trim();
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')!.trim();
    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: {
        transport: NodeWebSocket as unknown as typeof globalThis.WebSocket,
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
    return `${safeTenant}/${folder}/${randomUUID()}${params.ext}`;
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
    const { error } = await client.storage.from(this.bucket).upload(storagePath, params.buffer, {
      contentType: params.contentType,
      upsert: false,
      cacheControl: '3600',
    });

    if (error) {
      this.logger.error(`Supabase upload failed: ${error.message}`);
      throw new BadRequestException(`Storage upload failed: ${error.message}`);
    }

    const { data } = client.storage.from(this.bucket).getPublicUrl(storagePath);
    return { publicUrl: data.publicUrl, storagePath };
  }

  /**
   * Returns a Supabase public URL. Migrates legacy `/uploads/` or localhost paths on the fly.
   */
  async ensureSupabaseUrl(url: string, tenantId: string, prefix = 'uploads'): Promise<string> {
    if (!url?.trim()) return url;
    if (this.isSupabaseUrl(url)) return url;

    const localPath = this.localFilePath(url);
    if (!localPath || !existsSync(localPath)) {
      throw new BadRequestException(
        `Media URL is not in Supabase storage: ${basename(url)}. Re-upload the file from the Media Library.`,
      );
    }

    const ext = extname(localPath).toLowerCase();
    const contentType =
      ext === '.png' ? 'image/png'
      : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
      : ext === '.gif' ? 'image/gif'
      : ext === '.webp' ? 'image/webp'
      : ext === '.mp4' ? 'video/mp4'
      : 'application/octet-stream';

    const uploaded = await this.uploadBuffer({
      tenantId,
      buffer: readFileSync(localPath),
      contentType,
      originalName: basename(localPath),
      prefix,
    });

    this.logger.log(`Migrated legacy file to Supabase: ${basename(localPath)}`);
    return uploaded.publicUrl;
  }

  /** Read legacy local upload bytes (for publish fallbacks during migration). */
  readLocalUpload(url: string): { buffer: Buffer; contentType: string; filename: string } | null {
    const localPath = this.localFilePath(url);
    if (!localPath || !existsSync(localPath)) return null;
    const ext = extname(localPath).toLowerCase();
    const contentType =
      ext === '.png' ? 'image/png'
      : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
      : ext === '.mp4' ? 'video/mp4'
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
      /* keep as-is */
    }
    if (!pathname.startsWith('/uploads/')) return null;
    return join(process.cwd(), pathname.replace(/^\//, ''));
  }

  pathFromPublicUrl(publicUrl: string): string | null {
    if (!publicUrl) return null;
    const marker = `/storage/v1/object/public/${this.bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(publicUrl.slice(idx + marker.length));
  }

  async deleteByUrl(publicUrl: string): Promise<void> {
    if (!this.isSupabaseUrl(publicUrl)) return;
    const path = this.pathFromPublicUrl(publicUrl);
    if (!path) return;
    await this.deleteByPath(path);
  }

  async deleteByPath(storagePath: string): Promise<void> {
    const client = this.getClient();
    const { error } = await client.storage.from(this.bucket).remove([storagePath]);
    if (error) {
      this.logger.warn(`Supabase delete failed for ${storagePath}: ${error.message}`);
    }
  }
}
