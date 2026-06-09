import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantMembers } from './entities/tenant_members.entity';
import { TenantMembersCreateDto } from './dto/create-tenant_members.dto';
import { TenantMembersUpdateDto } from './dto/update-tenant_members.dto';
import { UserService } from '../user/user.service';
import { Profiles } from '../profiles/entities/profiles.entity';

@Injectable()
export class TenantMembersService {
  constructor(
    @InjectRepository(TenantMembers)
    private readonly repo: Repository<TenantMembers>,
    @InjectRepository(Profiles)
    private readonly profilesRepo: Repository<Profiles>,
    private readonly userService: UserService,
  ) {}

  async create(dto: TenantMembersCreateDto): Promise<TenantMembers> {
    const ent = this.repo.create(dto);
    return this.repo.save(ent as TenantMembers);
  }

  async findAll(tenantId?: string): Promise<TenantMembers[]> {
    if (tenantId) {
      return this.repo.find({ where: { tenantId }, order: { joinedAt: 'ASC' } });
    }
    return this.repo.find();
  }

  async findForUser(userId: string): Promise<TenantMembers[]> {
    return this.repo.find({ where: { userId, isActive: true } });
  }

  async findOne(id: string): Promise<TenantMembers> {
    const ent = await this.repo.findOne({ where: { id } });
    if (!ent) throw new NotFoundException('TenantMembers not found');
    return ent;
  }

  async findOneWithDetails(id: string, tenantId: string) {
    const member = await this.repo.findOne({ where: { id, tenantId } });
    if (!member) throw new NotFoundException('TenantMembers not found');
    const profile = await this.profilesRepo.findOne({ where: { userId: member.userId } });
    const user = await this.userService.findOne({ id: member.userId });
    return {
      ...member,
      profile: profile
        ? {
            fullName: profile.fullName,
            displayName: profile.displayName,
            email: user?.email ?? null,
            avatarUrl: profile.avatarUrl,
          }
        : { fullName: null, displayName: null, email: user?.email ?? null, avatarUrl: null },
    };
  }

  async listByTenant(tenantId: string) {
    const members = await this.repo.find({
      where: { tenantId, isActive: true },
      order: { joinedAt: 'ASC' },
    });
    return Promise.all(
      members.map(async (member) => {
        const profile = await this.profilesRepo.findOne({ where: { userId: member.userId } });
        const user = await this.userService.findOne({ id: member.userId });
        return {
          id: member.id,
          tenantId: member.tenantId,
          userId: member.userId,
          roleId: member.roleId,
          isActive: member.isActive,
          joinedAt: member.joinedAt,
          profile: profile
            ? {
                fullName: profile.fullName,
                displayName: profile.displayName,
                email: user?.email ?? null,
                avatarUrl: profile.avatarUrl,
              }
            : { fullName: null, displayName: null, email: user?.email ?? null, avatarUrl: null },
        };
      }),
    );
  }

  async invite(params: {
    email: string;
    tenantId: string;
    roleId: string;
    invitedBy: string;
  }): Promise<{ message: string; member?: TenantMembers }> {
    const user = await this.userService.findOne({ email: params.email });
    if (!user) {
      throw new BadRequestException(
        'No account found for this email. They must register first, then you can add them.',
      );
    }

    const existing = await this.repo.findOne({
      where: { tenantId: params.tenantId, userId: user.id },
    });

    if (existing) {
      if (existing.isActive) {
        throw new BadRequestException('User is already a member of this workspace');
      }
      existing.isActive = true;
      existing.roleId = params.roleId;
      existing.invitedBy = params.invitedBy;
      existing.joinedAt = new Date();
      const member = await this.repo.save(existing);
      return { message: 'Member re-activated', member };
    }

    const member = await this.repo.save(
      this.repo.create({
        tenantId: params.tenantId,
        userId: user.id,
        roleId: params.roleId,
        isActive: true,
        invitedBy: params.invitedBy,
        joinedAt: new Date(),
      }),
    );

    return { message: 'Member added successfully', member };
  }

  async update(id: string, dto: TenantMembersUpdateDto): Promise<TenantMembers> {
    await this.repo.update(id, dto as any);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (res.affected === 0) throw new NotFoundException('TenantMembers not found');
  }
}
