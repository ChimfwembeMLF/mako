import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
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
      return this.repo.find({
        where: { tenantId },
        order: { joinedAt: 'ASC' },
      });
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
    const profile = await this.profilesRepo.findOne({
      where: { userId: member.userId },
    });
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
        : {
            fullName: null,
            displayName: null,
            email: user?.email ?? null,
            avatarUrl: null,
          },
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
        const profile = await this.profilesRepo.findOne({
          where: { userId: member.userId },
        });
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
            : {
                fullName: null,
                displayName: null,
                email: user?.email ?? null,
                avatarUrl: null,
              },
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

  /**
   * Every invite, for a new or an existing Mako user, becomes a pending
   * invitation that the person accepts from the link in the email. Nobody is
   * added to a tenant without proving they control the invited address.
   */
  async invite(params: {
    email: string;
    tenantId: string;
    roleId: string;
    invitedBy: string;
  }): Promise<{
    message: string;
    invitation: TenantMemberInvitation;
    pending: true;
  }> {
    const email = this.normalizeEmail(params.email);
    const user = await this.userService.findOne({ email });

    if (user) {
      const existing = await this.repo.findOne({
        where: { tenantId: params.tenantId, userId: user.id },
      });
      if (existing?.isActive) {
        throw new BadRequestException(
          'User is already a member of this workspace',
        );
      }
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

    const tenant = await this.tenantsRepo.findOne({
      where: { id: params.tenantId },
    });
    const frontendUrl = resolveFrontendUrl(this.config);
    const acceptLink = `${frontendUrl}/invite?id=${invitation.id}&token=${this.invitationToken(invitation.id)}`;

    await this.mailService.sendWorkspaceInviteEmail(
      email,
      tenant?.name ?? 'Workspace',
      acceptLink,
      Boolean(user),
    );

    return {
      message: user
        ? 'Invitation sent — they need to accept it from the email before they join.'
        : 'Invitation sent — they can create an account from the email to join.',
      invitation,
      pending: true,
    };
  }

  /** Secret for an invitation link: proves the holder received the invite email. */
  invitationToken(invitationId: string): string {
    const secret =
      this.config.get<string>('INVITE_SECRET') ||
      this.config.get<string>('JWT_SECRET') ||
      'default_secret';
    return createHmac('sha256', secret)
      .update(`tenant-invite:${invitationId}`)
      .digest('base64url');
  }

  private assertInvitationToken(invitationId: string, token?: string): void {
    const expected = Buffer.from(this.invitationToken(invitationId));
    const given = Buffer.from(String(token ?? ''));
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      throw new ForbiddenException('This invitation link is not valid');
    }
  }

  /** Loads an invitation for the signed-in user from its emailed link. */
  private async invitationForUser(
    invitationId: string,
    token: string | undefined,
    userId: string,
  ): Promise<TenantMemberInvitation> {
    this.assertInvitationToken(invitationId, token);
    const inv = await this.invitationsRepo.findOne({ where: { id: invitationId } });
    if (!inv) throw new NotFoundException('Invitation not found');
    const user = await this.userService.findOne({ id: userId });
    if (!user?.email || this.normalizeEmail(user.email) !== inv.email) {
      throw new ForbiddenException(
        `This invitation was sent to ${inv.email}. Sign in with that email to accept it.`,
      );
    }
    return inv;
  }

  async previewInvitation(
    invitationId: string,
    token: string | undefined,
    userId: string,
  ) {
    const inv = await this.invitationForUser(invitationId, token, userId);
    const tenant = await this.tenantsRepo.findOne({ where: { id: inv.tenantId } });
    const inviter = await this.userService.findOne({ id: inv.invitedBy });
    const expired = inv.expiresAt.getTime() < Date.now();
    return {
      id: inv.id,
      email: inv.email,
      tenantId: inv.tenantId,
      tenantName: tenant?.name ?? 'Workspace',
      invitedBy:
        [inviter?.firstName, inviter?.lastName].filter(Boolean).join(' ') ||
        inviter?.email ||
        null,
      status: expired && inv.status === 'pending' ? 'expired' : inv.status,
      expiresAt: inv.expiresAt,
    };
  }

  async acceptInvitation(
    invitationId: string,
    token: string | undefined,
    userId: string,
  ): Promise<{ tenantId: string; member: TenantMembers }> {
    const inv = await this.invitationForUser(invitationId, token, userId);
    if (inv.status !== 'pending') {
      throw new BadRequestException(`This invitation was already ${inv.status}`);
    }
    if (inv.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException(
        'This invitation has expired. Ask for a new one.',
      );
    }

    const existing = await this.repo.findOne({
      where: { tenantId: inv.tenantId, userId },
    });
    let member: TenantMembers;
    if (existing) {
      existing.isActive = true;
      existing.roleId = inv.roleId;
      existing.invitedBy = inv.invitedBy;
      existing.joinedAt = new Date();
      member = await this.repo.save(existing);
    } else {
      member = await this.repo.save(
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
    inv.acceptedAt = new Date();
    await this.invitationsRepo.save(inv);
    return { tenantId: inv.tenantId, member };
  }

  async declineInvitation(
    invitationId: string,
    token: string | undefined,
    userId: string,
  ): Promise<void> {
    const inv = await this.invitationForUser(invitationId, token, userId);
    if (inv.status !== 'pending') return;
    inv.status = 'declined';
    await this.invitationsRepo.save(inv);
  }

  async revokeInvitation(id: string, tenantId: string): Promise<void> {
    const inv = await this.invitationsRepo.findOne({
      where: { id, tenantId, status: 'pending' },
    });
    if (!inv) throw new NotFoundException('Invitation not found');
    inv.status = 'revoked';
    await this.invitationsRepo.save(inv);
  }

  async update(
    id: string,
    dto: TenantMembersUpdateDto,
  ): Promise<TenantMembers> {
    await this.repo.update(id, dto as any);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (res.affected === 0)
      throw new NotFoundException('TenantMembers not found');
  }
}
