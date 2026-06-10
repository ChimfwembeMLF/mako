import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentTemplates } from './entities/content_templates.entity';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(ContentTemplates)
    private readonly repo: Repository<ContentTemplates>,
  ) {}

  create(dto: Partial<ContentTemplates>) {
    return this.repo.save(this.repo.create(dto));
  }

  findByTenant(tenantId: string) {
    return this.repo.find({ where: { tenantId }, order: { updated_at: 'DESC' } });
  }

  findActiveByTenant(tenantId: string) {
    return this.repo.find({
      where: { tenantId, isActive: true },
      order: { updated_at: 'DESC' },
    });
  }

  async findActiveForPlatform(tenantId: string, platform: string) {
    const normalized = platform.toLowerCase();
    const active = await this.findActiveByTenant(tenantId);
    return (
      active.find((t) => t.platforms?.map((p) => p.toLowerCase()).includes(normalized)) ??
      active.find((t) => t.contentType?.toLowerCase() === normalized) ??
      null
    );
  }

  async findForGeneration(params: {
    tenantId: string;
    templateId?: string;
    platform?: string;
    contentType?: string;
  }) {
    if (params.templateId) {
      return this.findOne(params.templateId, params.tenantId);
    }
    if (params.platform) {
      const byPlatform = await this.findActiveForPlatform(params.tenantId, params.platform);
      if (byPlatform) return byPlatform;
    }
    if (params.contentType) {
      const active = await this.findActiveByTenant(params.tenantId);
      return (
        active.find((t) => t.contentType?.toLowerCase() === params.contentType!.toLowerCase()) ??
        null
      );
    }
    return null;
  }

  async findOne(id: string, tenantId?: string) {
    const ent = await this.repo.findOne({
      where: tenantId ? { id, tenantId } : { id },
    });
    if (!ent) throw new NotFoundException('Template not found');
    return ent;
  }

  async update(id: string, dto: Partial<ContentTemplates>, tenantId?: string) {
    await this.findOne(id, tenantId);
    await this.repo.update(id, dto as any);
    return this.findOne(id, tenantId);
  }

  async remove(id: string, tenantId?: string) {
    await this.findOne(id, tenantId);
    await this.repo.delete(id);
  }
}
