import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MediaAssets } from '../content_items/entities/media_assets.entity';
import { SupabaseStorageService } from './supabase-storage.service';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(MediaAssets)
    private readonly mediaRepo: Repository<MediaAssets>,
    private readonly storage: SupabaseStorageService,
  ) {}

  async findByTenant(tenantId: string) {
    if (!tenantId) return [];
    return this.mediaRepo.find({
      where: { tenantId },
      order: { created_at: 'DESC' },
    });
  }

  async upload(params: {
    tenantId: string;
    userId: string;
    file: Express.Multer.File;
    contentId?: string;
  }) {
    this.storage.assertConfigured();

    if (!params.tenantId) throw new BadRequestException('tenantId is required');
    if (!params.file?.buffer?.length) throw new BadRequestException('file is required');
    if (params.file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('File exceeds 50 MB limit');
    }

    const mediaType = params.file.mimetype.startsWith('video/') ? 'video' : 'image';

    const uploaded = await this.storage.uploadBuffer({
      tenantId: params.tenantId,
      buffer: params.file.buffer,
      contentType: params.file.mimetype,
      originalName: params.file.originalname,
      prefix: 'uploads',
    });

    return this.mediaRepo.save(
      this.mediaRepo.create({
        tenantId: params.tenantId,
        contentId: params.contentId,
        mediaUrl: uploaded.publicUrl,
        mediaType,
        name: params.file.originalname,
        uploadedBy: params.userId,
        fileSizeBytes: String(params.file.size),
      }),
    );
  }

  async attachToContent(params: {
    tenantId: string;
    contentId: string;
    items: Array<{ url: string; type?: string; assetId?: string }>;
    userId: string;
  }) {
    this.storage.assertConfigured();
    const saved: MediaAssets[] = [];

    for (const item of params.items) {
      const existing = await this.findExistingAsset(
        params.tenantId,
        item.url,
        item.assetId,
      );

      if (existing) {
        if (existing.contentId !== params.contentId) {
          existing.contentId = params.contentId;
          saved.push(await this.mediaRepo.save(existing));
        } else {
          saved.push(existing);
        }
        continue;
      }

      const mediaUrl = this.storage.isSupabaseUrl(item.url)
        ? item.url
        : await this.storage.ensureSupabaseUrl(item.url, params.tenantId);

      const linked = await this.mediaRepo.findOne({
        where: {
          tenantId: params.tenantId,
          contentId: params.contentId,
          mediaUrl,
        },
      });
      if (linked) {
        saved.push(linked);
        continue;
      }

      saved.push(
        await this.mediaRepo.save(
          this.mediaRepo.create({
            tenantId: params.tenantId,
            contentId: params.contentId,
            mediaUrl,
            mediaType: item.type ?? 'image',
            uploadedBy: params.userId,
          }),
        ),
      );
    }
    return saved;
  }

  /** Reuse library assets by id or canonical storage URL — avoids re-uploading files. */
  private async findExistingAsset(
    tenantId: string,
    url: string,
    assetId?: string,
  ): Promise<MediaAssets | null> {
    if (assetId) {
      const byId = await this.mediaRepo.findOne({ where: { id: assetId, tenantId } });
      if (byId) return byId;
    }

    const direct = await this.mediaRepo.findOne({ where: { tenantId, mediaUrl: url } });
    if (direct) return direct;

    const storagePath = this.storage.isSupabaseUrl(url)
      ? this.storage.pathFromPublicUrl(url)
      : null;
    if (!storagePath) return null;

    return this.mediaRepo
      .createQueryBuilder('m')
      .where('m.tenant_id = :tenantId', { tenantId })
      .andWhere('m.media_url LIKE :pattern', { pattern: `%${storagePath}%` })
      .getOne();
  }

  async remove(id: string, tenantId: string) {
    const asset = await this.mediaRepo.findOne({ where: { id, tenantId } });
    if (!asset) throw new NotFoundException('Media not found');

    await this.storage.deleteByUrl(asset.mediaUrl);
    await this.mediaRepo.delete(id);
    return { deleted: true };
  }
}
