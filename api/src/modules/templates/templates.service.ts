import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentTemplates } from './entities/content_templates.entity';
import { scopeWhere, scopeWhereIncludingTenantWide } from '../../common/workspace-scope.util';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(ContentTemplates)
    private readonly repo: Repository<ContentTemplates>,
  ) {}

  create(dto: Partial<ContentTemplates>) {
    return this.repo.save(this.repo.create(dto));
  }

  async findByTenant(tenantId: string, workspaceId?: string) {
    const records = await this.repo.find({
      where: scopeWhereIncludingTenantWide<ContentTemplates>(tenantId, workspaceId),
      order: { updated_at: 'DESC' },
    });
    if (!workspaceId) return records;
    const wsNames = new Set(records.filter(r => r.workspaceId === workspaceId).map(r => r.name));
    return records.filter(r => r.workspaceId === workspaceId || !wsNames.has(r.name));
  }

  async findActiveByTenant(tenantId: string, workspaceId?: string) {
    const records = await this.repo.find({
      where: scopeWhereIncludingTenantWide<ContentTemplates>(tenantId, workspaceId, { isActive: true }),
      order: { updated_at: 'DESC' },
    });
    if (!workspaceId) return records;
    const wsNames = new Set(records.filter(r => r.workspaceId === workspaceId).map(r => r.name));
    return records.filter(r => r.workspaceId === workspaceId || !wsNames.has(r.name));
  }

  async findActiveForPlatform(
    tenantId: string,
    platform: string,
    workspaceId?: string,
  ) {
    const normalized = platform.toLowerCase();
    const active = await this.findActiveByTenant(tenantId, workspaceId);
    return (
      active.find((t) =>
        t.platforms?.map((p) => p.toLowerCase()).includes(normalized),
      ) ??
      active.find((t) => t.contentType?.toLowerCase() === normalized) ??
      null
    );
  }

  async findForGeneration(params: {
    tenantId: string;
    workspaceId?: string;
    templateId?: string;
    platform?: string;
    contentType?: string;
  }) {
    if (params.templateId) {
      return this.findOne(
        params.templateId,
        params.tenantId,
        params.workspaceId,
      );
    }
    if (params.platform) {
      const byPlatform = await this.findActiveForPlatform(
        params.tenantId,
        params.platform,
        params.workspaceId,
      );
      if (byPlatform) return byPlatform;
    }
    if (params.contentType) {
      const active = await this.findActiveByTenant(
        params.tenantId,
        params.workspaceId,
      );
      return (
        active.find(
          (t) =>
            t.contentType?.toLowerCase() === params.contentType!.toLowerCase(),
        ) ?? null
      );
    }
    return null;
  }

  async findOne(id: string, tenantId?: string, workspaceId?: string) {
    const where: { id: string; tenantId?: string; workspaceId?: string } = {
      id,
    };
    if (tenantId) where.tenantId = tenantId;
    if (workspaceId) where.workspaceId = workspaceId;
    const ent = await this.repo.findOne({ where });
    if (!ent) throw new NotFoundException('Template not found');
    return ent;
  }

  async update(
    id: string,
    dto: Partial<ContentTemplates>,
    tenantId?: string,
    workspaceId?: string,
  ) {
    await this.findOne(id, tenantId, workspaceId);
    await this.repo.update(id, dto as any);
    return this.findOne(id, tenantId, workspaceId);
  }

  async remove(id: string, tenantId?: string, workspaceId?: string) {
    await this.findOne(id, tenantId, workspaceId);
    await this.repo.delete(id);
  }
}
