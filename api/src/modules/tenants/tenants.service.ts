import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Tenants } from './entities/tenants.entity';
import { TenantsCreateDto } from './dto/create-tenants.dto';
import { TenantsUpdateDto } from './dto/update-tenants.dto';
import { TenantMembers } from '../tenant_members/entities/tenant_members.entity';
import { UserEntity } from '../user/user.entity';
import { TenantBootstrapService } from './tenant-bootstrap.service';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenants)
    private readonly repo: Repository<Tenants>,
    @InjectRepository(TenantMembers)
    private readonly membersRepo: Repository<TenantMembers>,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    private readonly bootstrap: TenantBootstrapService,
  ) {}

  async create(dto: TenantsCreateDto): Promise<Tenants> {
    const ent = this.repo.create(dto);
    return this.repo.save(ent as Tenants);
  }

  async findAll(): Promise<Tenants[]> {
    return this.repo.find();
  }

  async findForUser(userId: string): Promise<Tenants[]> {
    const memberships = await this.membersRepo.find({
      where: { userId, isActive: true },
    });
    if (!memberships.length) return [];
    const tenantIds = memberships.map((m) => m.tenantId);
    return this.repo.find({ where: { id: In(tenantIds) } });
  }

  /** Ensures a default tenant exists — safety net for legacy users or failed first login */
  async findForUserEnsuringBootstrap(userId: string): Promise<Tenants[]> {
    let tenants = await this.findForUser(userId);
    const user = await this.usersRepo.findOne({ where: { id: userId } });

    if (tenants.length) {
      if (user) {
        await this.bootstrap.seedDefaultsForUserTenants(user);
      }
      for (const t of tenants) {
        await this.bootstrap.ensureSubscriptionForExistingTenant(t.id);
      }
      return tenants;
    }

    if (!user) return [];

    await this.bootstrap.bootstrapForUser(user);
    tenants = await this.findForUser(userId);
    for (const t of tenants) {
      await this.bootstrap.ensureSubscriptionForExistingTenant(t.id);
    }
    return tenants;
  }

  async findOne(id: string): Promise<Tenants> {
    const ent = await this.repo.findOne({ where: { id } });
    if (!ent) throw new NotFoundException('Tenants not found');
    return ent;
  }

  async update(id: string, dto: TenantsUpdateDto): Promise<Tenants> {
    await this.repo.update(id, dto as any);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (res.affected === 0) throw new NotFoundException('Tenants not found');
  }
}
