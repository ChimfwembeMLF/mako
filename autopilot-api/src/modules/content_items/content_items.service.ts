import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentItems } from './entities/content_items.entity';
import { MediaAssets } from './entities/media_assets.entity';
import { ContentItemsCreateDto } from './dto/create-content_items.dto';
import { ContentItemsUpdateDto } from './dto/update-content_items.dto';
import { ContentPublicationsService } from '../content_publications/content-publications.service';
import { ContentPublications } from '../content_publications/entities/content_publications.entity';

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
    const ent = this.repo.create(dto);
    return this.repo.save(ent as ContentItems);
  }

  async findAll(tenantId?: string): Promise<ContentItems[]> {
    if (tenantId) {
      return this.repo.find({ where: { tenantId } });
    }
    return this.repo.find();
  }

  async findOne(id: string): Promise<ContentItems> {
    const ent = await this.repo.findOne({ where: { id } });
    if (!ent) throw new NotFoundException('ContentItems not found');
    return ent;
  }

  async getDetails(id: string): Promise<ContentItemDetails> {
    const item = await this.findOne(id);
    const publications = await this.publications.findByContentId(id);
    const media = await this.mediaRepo.find({
      where: { contentId: id, tenantId: item.tenantId },
      order: { created_at: 'ASC' },
    });

    if (typeof item.platformPayloads === 'string') {
      try {
        (item as { platformPayloads?: unknown }).platformPayloads = JSON.parse(
          item.platformPayloads,
        );
      } catch {
        item.platformPayloads = undefined;
      }
    }

    return { item, publications, media };
  }

  async update(id: string, dto: ContentItemsUpdateDto): Promise<ContentItems> {
    await this.repo.update(id, dto as any);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (res.affected === 0)
      throw new NotFoundException('ContentItems not found');
  }
}
