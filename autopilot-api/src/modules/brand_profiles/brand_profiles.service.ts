import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { BrandProfiles } from './entities/brand_profiles.entity';
import { Workspaces } from '../workspaces/entities/workspaces.entity';
import { BrandProfilesCreateDto } from './dto/create-brand_profiles.dto';
import { BrandProfilesUpdateDto } from './dto/update-brand_profiles.dto';

@Injectable()
export class BrandProfilesService {
  constructor(
    @InjectRepository(BrandProfiles)
    private readonly repo: Repository<BrandProfiles>,
    @InjectRepository(Workspaces)
    private readonly workspaceRepo: Repository<Workspaces>,
  ) {}

  async create(dto: BrandProfilesCreateDto): Promise<BrandProfiles> {
    return this.upsert(dto);
  }

  async upsert(dto: BrandProfilesCreateDto): Promise<BrandProfiles> {
    if (!dto.tenantId) {
      throw new BadRequestException('tenantId is required');
    }
    if (!dto.userId) {
      throw new BadRequestException('userId is required');
    }

    if (dto.workspaceId) {
      const workspace = await this.workspaceRepo.findOne({
        where: { id: dto.workspaceId, tenantId: dto.tenantId },
      });
      if (!workspace) {
        throw new BadRequestException(
          'workspaceId does not belong to this tenant',
        );
      }
    }

    const existing = dto.workspaceId
      ? await this.findForWorkspace(dto.workspaceId, dto.tenantId)
      : await this.findForTenantUser(dto.tenantId, dto.userId);

    if (existing) {
      if (dto.workspaceId && existing.workspaceId !== dto.workspaceId) {
        throw new BadRequestException(
          'Brand profile belongs to a different workspace',
        );
      }
      const { userId: _uid, tenantId: _tid, workspaceId: _ws, ...patch } = dto;
      await this.repo.update(existing.id, patch as BrandProfilesUpdateDto);
      return this.findOne(existing.id);
    }

    const ent = this.repo.create(dto);
    return this.repo.save(ent as BrandProfiles);
  }

  async findAll(tenantId?: string): Promise<BrandProfiles[]> {
    if (tenantId) return this.repo.find({ where: { tenantId } });
    return this.repo.find();
  }

  async findForTenant(tenantId: string): Promise<BrandProfiles[]> {
    return this.repo.find({ where: { tenantId } });
  }

  async findForTenantUser(
    tenantId: string,
    userId: string,
  ): Promise<BrandProfiles | null> {
    return this.repo.findOne({
      where: { tenantId, userId, workspaceId: IsNull() },
    });
  }

  async findForWorkspace(
    workspaceId: string,
    tenantId?: string,
  ): Promise<BrandProfiles | null> {
    return this.repo.findOne({
      where: tenantId ? { workspaceId, tenantId } : { workspaceId },
    });
  }

  /** Workspace profile only when workspaceId is set; legacy tenant+user profile otherwise. */
  async resolveForContext(params: {
    tenantId: string;
    userId: string;
    workspaceId?: string;
  }): Promise<BrandProfiles | null> {
    if (params.workspaceId) {
      return this.findForWorkspace(params.workspaceId, params.tenantId);
    }
    return this.findForTenantUser(params.tenantId, params.userId);
  }

  /** Create an empty brand profile shell when a workspace is created. */
  async ensureForWorkspace(
    tenantId: string,
    workspaceId: string,
    userId: string,
  ): Promise<BrandProfiles | null> {
    const existing = await this.findForWorkspace(workspaceId, tenantId);
    if (existing) return existing;

    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId, tenantId },
    });
    if (!workspace) return null;

    return this.repo.save(
      this.repo.create({
        tenantId,
        userId,
        workspaceId,
        companyName: workspace.name,
        toneOfVoice: 'Professional, clear, and friendly',
        brandPersonality: 'Helpful and trustworthy',
      }),
    );
  }

  async findOne(id: string): Promise<BrandProfiles> {
    const ent = await this.repo.findOne({ where: { id } });
    if (!ent) throw new NotFoundException('BrandProfiles not found');
    return ent;
  }

  async update(
    id: string,
    dto: BrandProfilesUpdateDto,
  ): Promise<BrandProfiles> {
    await this.repo.update(id, dto as any);
    return this.findOne(id);
  }

  async updateForUser(
    id: string,
    userId: string,
    dto: BrandProfilesUpdateDto,
  ): Promise<BrandProfiles> {
    const existing = await this.findOne(id);
    if (existing.userId !== userId) {
      throw new NotFoundException('BrandProfiles not found');
    }
    return this.update(id, dto);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (res.affected === 0)
      throw new NotFoundException('BrandProfiles not found');
  }
}
