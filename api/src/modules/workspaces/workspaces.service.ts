import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Workspaces } from './entities/workspaces.entity';
import { WorkspaceAutomationConfig } from './entities/workspace-automation-config.entity';
import { WorkspacesCreateDto } from './dto/create-workspaces.dto';
import { WorkspacesUpdateDto } from './dto/update-workspaces.dto';
import { UpdateAutomationConfigDto } from './dto/update-automation-config.dto';
import { BrandProfilesService } from '../brand_profiles/brand_profiles.service';
import { TemplateSeedService } from '../templates/template-seed.service';
import { AutoReplySeedService } from '../auto_reply_rules/auto-reply-seed.service';
import { AuditLogsService } from '../audit_logs/audit_logs.service';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectRepository(Workspaces)
    private readonly repo: Repository<Workspaces>,
    @InjectRepository(WorkspaceAutomationConfig)
    private readonly automationRepo: Repository<WorkspaceAutomationConfig>,
    private readonly brandProfiles: BrandProfilesService,
    private readonly templateSeeds: TemplateSeedService,
    private readonly autoReplySeeds: AutoReplySeedService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async create(dto: WorkspacesCreateDto, userId: string): Promise<Workspaces> {
    const ent = this.repo.create(dto);
    const saved = await this.repo.save(ent as Workspaces);
    
    // Create necessary starter data specific to this workspace
    await this.brandProfiles.ensureForWorkspace(dto.tenantId, saved.id, userId);
    await this.templateSeeds.ensureSeededForWorkspace(dto.tenantId, saved.id, userId);
    await this.autoReplySeeds.ensureSeededForWorkspace(dto.tenantId, saved.id);
    await this.getAutomationConfig(saved.id); // ensures automation config is created
    
    return saved;
  }

  async findAll(tenantId?: string): Promise<Workspaces[]> {
    if (tenantId) {
      return this.repo.find({
        where: { tenantId },
        order: { created_at: 'ASC' },
      });
    }
    return this.repo.find();
  }

  async findForTenants(tenantIds: string[]): Promise<Workspaces[]> {
    if (!tenantIds.length) return [];
    return this.repo.find({
      where: { tenantId: In(tenantIds) },
      order: { created_at: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Workspaces> {
    const ent = await this.repo.findOne({ where: { id } });
    if (!ent) throw new NotFoundException('Workspaces not found');
    return ent;
  }

  async update(id: string, dto: WorkspacesUpdateDto): Promise<Workspaces> {
    await this.repo.update(id, dto as Partial<Workspaces>);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (res.affected === 0) throw new NotFoundException('Workspaces not found');
  }

  async getAutomationConfig(workspaceId: string): Promise<WorkspaceAutomationConfig> {
    let config = await this.automationRepo.findOne({ where: { workspaceId } });
    if (!config) {
      config = this.automationRepo.create({ workspaceId });
      config = await this.automationRepo.save(config);
    }
    return config;
  }

  async updateAutomationConfig(workspaceId: string, payload: UpdateAutomationConfigDto): Promise<WorkspaceAutomationConfig> {
    let config = await this.automationRepo.findOne({ where: { workspaceId } });
    const workspace = await this.repo.findOne({ where: { id: workspaceId } });

    if (!config) {
      config = this.automationRepo.create({ workspaceId, ...payload });
      const saved = await this.automationRepo.save(config);
      await this.auditLogs.recordChange({
        tenantId: workspace?.tenantId,
        action: 'workspace_automation_config.created',
        resourceType: 'workspace_automation_config',
        resourceId: saved.id,
        afterState: saved,
        metadata: { workspaceId },
      });
      return saved;
    }

    const beforeState = { ...config };
    await this.automationRepo.update(config.id, payload);
    const updated = await this.automationRepo.findOneOrFail({ where: { workspaceId } });

    await this.auditLogs.recordChange({
      tenantId: workspace?.tenantId,
      action: 'workspace_automation_config.updated',
      resourceType: 'workspace_automation_config',
      resourceId: updated.id,
      beforeState,
      afterState: updated,
      metadata: { workspaceId, changedFields: Object.keys(payload) },
    });

    return updated;
  }
}
