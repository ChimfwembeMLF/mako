import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ContentItems } from './entities/content_items.entity';
import { MediaAssets } from './entities/media_assets.entity';
import { ContentItemsCreateDto } from './dto/create-content_items.dto';
import { ContentItemsUpdateDto } from './dto/update-content_items.dto';
import {
  ListContentItemsQueryDto,
  PaginatedContentItems,
  CONTENT_STATUS_GROUPS,
  STATUSES_BY_GROUP,
  type ContentStatusGroup,
} from './dto/list-content-items.dto';
import { ContentPublicationsService } from '../content_publications/content-publications.service';
import { ContentPublications } from '../content_publications/entities/content_publications.entity';
import { applyWorkspaceScope } from '../../common/workspace-scope.util';

export type ContentItemWithPreviewMedia = ContentItems & {
  previewMedia?: MediaAssets | null;
  /** Number of media assets attached to the item. */
  mediaCount?: number;
};

export type ContentItemDetails = {
  item: ContentItems;
  publications: ContentPublications[];
  media: MediaAssets[];
};

@Injectable()
export class ContentItemsService {
  constructor(
    @InjectRepository(ContentItems)
    private readonly repo: Repository<ContentItems>,
    @InjectRepository(MediaAssets)
    private readonly mediaRepo: Repository<MediaAssets>,
    private readonly publications: ContentPublicationsService,
  ) {}

  async create(dto: ContentItemsCreateDto): Promise<ContentItems> {
    const patch: ContentItemsCreateDto = { ...dto };
    if (
      patch.platformPayloads != null &&
      typeof patch.platformPayloads === 'string'
    ) {
      try {
        patch.platformPayloads = JSON.parse(patch.platformPayloads) as Record<
          string,
          unknown
        >;
      } catch {
        patch.platformPayloads = undefined;
      }
    }
    const ent = this.repo.create(patch as Partial<ContentItems>);
    const saved = await this.repo.save(ent as ContentItems);
    return this.normalizePlatformPayloads(saved);
  }

  async findAll(
    tenantId?: string,
    workspaceId?: string,
    options?: { includeMedia?: boolean },
  ): Promise<ContentItemWithPreviewMedia[]> {
    const qb = this.repo.createQueryBuilder('item');

    if (tenantId) {
      qb.andWhere('item.tenantId = :tenantId', { tenantId });
    }
    applyWorkspaceScope(qb, 'item', workspaceId);

    qb.orderBy('item.created_at', 'DESC').take(500);

    const items = (await qb.getMany()).map((item) =>
      this.normalizePlatformPayloads(item),
    );

    if (!options?.includeMedia || items.length === 0) {
      return items;
    }

    return this.attachPreviewMedia(items);
  }

  private async attachPreviewMedia(
    items: ContentItems[],
  ): Promise<ContentItemWithPreviewMedia[]> {
    const ids = items.map((item) => item.id);
    const mediaRows = await this.mediaRepo.find({
      where: { contentId: In(ids) },
      order: { created_at: 'ASC' },
    });

    const firstByContent = new Map<string, MediaAssets>();
    const countByContent = new Map<string, number>();
    for (const row of mediaRows) {
      if (!row.contentId) continue;
      countByContent.set(row.contentId, (countByContent.get(row.contentId) ?? 0) + 1);
      if (!firstByContent.has(row.contentId)) firstByContent.set(row.contentId, row);
    }

    return items.map((item) => ({
      ...item,
      previewMedia: firstByContent.get(item.id) ?? null,
      mediaCount: countByContent.get(item.id) ?? 0,
    }));
  }

  async findPaginated(params: {
    tenantId?: string;
    userId?: string;
    workspaceId?: string;
    page?: number;
    limit?: number;
    search?: string;
    platform?: string;
    status?: ContentStatusGroup;
  }): Promise<PaginatedContentItems> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(50, Math.max(1, params.limit ?? 6));
    const skip = (page - 1) * limit;

    // Everything except the status tab, so the tab counts share the same filters.
    const base = () => {
      const qb = this.repo.createQueryBuilder('item');
      if (params.tenantId) {
        qb.andWhere('item.tenantId = :tenantId', { tenantId: params.tenantId });
      }
      if (params.userId) {
        qb.andWhere('item.userId = :userId', { userId: params.userId });
      }
      if (params.workspaceId) {
        applyWorkspaceScope(qb, 'item', params.workspaceId);
      }
      if (params.search?.trim()) {
        qb.andWhere(
          '(item.title ILIKE :search OR item.content ILIKE :search)',
          { search: `%${params.search.trim()}%` },
        );
      }
      if (params.platform?.trim()) {
        qb.andWhere(':platform = ANY(item.platforms)', {
          platform: params.platform.trim(),
        });
      }
      return qb;
    };

    const qb = base();
    if (params.status) {
      qb.andWhere('item.status IN (:...statuses)', {
        statuses: STATUSES_BY_GROUP[params.status],
      });
    }
    qb.orderBy('item.created_at', 'DESC').skip(skip).take(limit);

    const [[items, total], countRows] = await Promise.all([
      qb.getManyAndCount(),
      base()
        .select('item.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('item.status')
        .getRawMany<{ status: string | null; count: string }>(),
    ]);

    const statusCounts = {
      all: 0,
      drafts: 0,
      scheduled: 0,
      published: 0,
      failed: 0,
    };
    for (const row of countRows) {
      const n = Number(row.count) || 0;
      statusCounts.all += n;
      const group = CONTENT_STATUS_GROUPS.find((g) =>
        STATUSES_BY_GROUP[g].includes(row.status ?? 'draft'),
      );
      if (group) statusCounts[group] += n;
    }

    const withMedia = items.length
      ? await this.attachPreviewMedia(
          items.map((item) => this.normalizePlatformPayloads(item)),
        )
      : [];

    return {
      items: withMedia,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      statusCounts,
    };
  }

  async findOne(id: string): Promise<ContentItems> {
    const ent = await this.repo.findOne({ where: { id } });
    if (!ent) throw new NotFoundException('ContentItems not found');
    return this.normalizePlatformPayloads(ent);
  }

  private normalizePlatformPayloads(item: ContentItems): ContentItems {
    const raw = item.platformPayloads;
    if (raw == null) return item;
    if (typeof raw === 'string') {
      try {
        item.platformPayloads = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        item.platformPayloads = undefined;
      }
    }
    return item;
  }

  async getDetails(id: string): Promise<ContentItemDetails> {
    const item = await this.findOne(id);
    const publications = await this.publications.findByContentId(id);
    const media = await this.mediaRepo.find({
      where: { contentId: id, tenantId: item.tenantId },
      order: { created_at: 'ASC' },
    });

    return { item, publications, media };
  }

  async update(id: string, dto: ContentItemsUpdateDto): Promise<ContentItems> {
    const patch: ContentItemsUpdateDto = { ...dto };
    if (
      patch.platformPayloads != null &&
      typeof patch.platformPayloads === 'string'
    ) {
      try {
        patch.platformPayloads = JSON.parse(patch.platformPayloads) as Record<
          string,
          unknown
        >;
      } catch {
        patch.platformPayloads = undefined;
      }
    }
    await this.repo.update(id, patch as Partial<ContentItems>);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (res.affected === 0)
      throw new NotFoundException('ContentItems not found');
  }

  async bulkRemove(ids: string[]): Promise<number> {
    if (!ids?.length) return 0;
    const res = await this.repo.delete(ids);
    return res.affected ?? 0;
  }
}
