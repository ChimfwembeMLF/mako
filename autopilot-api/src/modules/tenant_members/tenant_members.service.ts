import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, MoreThan } from 'typeorm';
import { TenantMembers } from './entities/tenant_members.entity';
import { TenantMemberInvitation } from './entities/tenant_member_invitation.entity';
import { TenantMembersCreateDto } from './dto/create-tenant_members.dto';
import { TenantMembersUpdateDto } from './dto/update-tenant_members.dto';
import { UserService } from '../user/user.service';
import { Profiles } from '../profiles/entities/profiles.entity';
import { Tenants } from '../tenants/entities/tenants.entity';
import { MailService } from '../mail/mail.service';
import { resolveFrontendUrl } from '../../common/env-urls.util';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class TenantMembersService {
  constructor(
    @InjectRepository(TenantMembers)
    private readonly repo: Repository<TenantMembers>,
    @InjectRepository(TenantMemberInvitation)
    private readonly invitationsRepo: Repository<TenantMemberInvitation>,
    @InjectRepository(Profiles)
    private readonly profilesRepo: Repository<Profiles>,
    @InjectRepository(Tenants)
    private readonly tenantsRepo: Repository<Tenants>,
    private readonly userService: UserService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

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

  async listPendingInvitations(tenantId: string) {
    const now = new Date();
    const rows = await this.invitationsRepo.find({
      where: { tenantId, status: 'pending', expiresAt: MoreThan(now) },
      order: { created_at: 'DESC' },
    });
    return rows.map((inv) => ({
      id: inv.id,
      email: inv.email,
      roleId: inv.roleId,
      status: 'pending' as const,
      invitedAt: inv.created_at,
      expiresAt: inv.expiresAt,
    }));
  }

  async listByTenant(tenantId: string) {
    const members = await this.repo.find({
      where: { tenantId, isActive: true },
      order: { joinedAt: 'ASC' },
    });
    const memberRows = await Promise.all(
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
          status: 'active' as const,
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

    const pending = await this.listPendingInvitations(tenantId);
    const pendingRows = pending.map((inv) => ({
      id: inv.id,
      tenantId,
      userId: null,
      roleId: inv.roleId,
      isActive: false,
      joinedAt: inv.invitedAt,
      status: 'pending' as const,
      profile: {
        fullName: null,
        displayName: null,
        email: inv.email,
        avatarUrl: null,
      },
    }));

    return [...memberRows, ...pendingRows];
  }

  async invite(params: {
    email: string;
    tenantId: string;
    roleId: string;
    invitedBy: string;
  }): Promise<{ message: string; member?: TenantMembers; invitation?: TenantMemberInvitation; pending?: boolean }> {
    const email = this.normalizeEmail(params.email);
    const user = await this.userService.findOne({ email });

    if (user) {
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
        await this.revokePendingInvitations(email, params.tenantId);
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
      await this.revokePendingInvitations(email, params.tenantId);
      return { message: 'Member added successfully', member };
    }

    const pending = await this.invitationsRepo.findOne({
      where: { tenantId: params.tenantId, email, status: 'pending' },
    });

    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    let invitation: TenantMemberInvitation;

    if (pending) {
      pending.roleId = params.roleId;
      pending.invitedBy = params.invitedBy;
      pending.expiresAt = expiresAt;
      invitation = await this.invitationsRepo.save(pending);
    } else {
      invitation = await this.invitationsRepo.save(
        this.invitationsRepo.create({
          tenantId: params.tenantId,
          email,
          roleId: params.roleId,
          invitedBy: params.invitedBy,
          status: 'pending',
          expiresAt,
        }),
      );
    }

    const tenant = await this.tenantsRepo.findOne({ where: { id: params.tenantId } });
    const frontendUrl = resolveFrontendUrl(this.config);
    const signupLink = `${frontendUrl}/auth?email=${encodeURIComponent(email)}`;

    await this.mailService.sendWorkspaceInviteEmail(
      email,
      tenant?.name ?? 'Workspace',
      signupLink,
    );

    return {
      message: 'Invitation sent — they can register or sign in with this email to join.',
      invitation,
      pending: true,
    };
  }

  async revokeInvitation(id: string, tenantId: string): Promise<void> {
    const inv = await this.invitationsRepo.findOne({ where: { id, tenantId, status: 'pending' } });
    if (!inv) throw new NotFoundException('Invitation not found');
    inv.status = 'revoked';
    await this.invitationsRepo.save(inv);
  }

  async acceptPendingInvitations(userId: string, email: string): Promise<number> {
    const normalized = this.normalizeEmail(email);
    const now = new Date();
    const pending = await this.invitationsRepo.find({
      where: { email: normalized, status: 'pending', expiresAt: MoreThan(now) },
    });

    let accepted = 0;
    for (const inv of pending) {
      const existing = await this.repo.findOne({
        where: { tenantId: inv.tenantId, userId },
      });

      if (existing) {
        if (!existing.isActive) {
          existing.isActive = true;
          existing.roleId = inv.roleId;
          existing.invitedBy = inv.invitedBy;
          existing.joinedAt = new Date();
          await this.repo.save(existing);
        }
      } else {
        await this.repo.save(
          this.repo.create({
            tenantId: inv.tenantId,
            userId,
            roleId: inv.roleId,
            isActive: true,
            invitedBy: inv.invitedBy,
            joinedAt: new Date(),
          }),
        );
      }

      inv.status = 'accepted';
      inv.acceptedAt = now;
      await this.invitationsRepo.save(inv);
      accepted += 1;
    }

    return accepted;
  }

  private async revokePendingInvitations(email: string, tenantId: string): Promise<void> {
    const pending = await this.invitationsRepo.find({
      where: { tenantId, email, status: 'pending' },
    });
    for (const inv of pending) {
      inv.status = 'revoked';
      await this.invitationsRepo.save(inv);
    }
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
