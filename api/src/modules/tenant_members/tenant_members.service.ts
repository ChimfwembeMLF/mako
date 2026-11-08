import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { In, Repository, MoreThan } from 'typeorm';
import { TenantMembers } from './entities/tenant_members.entity';
import { TenantMemberInvitation } from './entities/tenant_member_invitation.entity';
import { TenantMembersCreateDto } from './dto/create-tenant_members.dto';
import { TenantMembersUpdateDto } from './dto/update-tenant_members.dto';
import { UserService } from '../user/user.service';
import { Profiles } from '../profiles/entities/profiles.entity';
import { Tenants } from '../tenants/entities/tenants.entity';
import { MailService } from '../mail/mail.service';
import { resolveFrontendUrl } from '../../common/env-urls.util';
import { GmailService } from '../auth/gmail.service';
import { Roles } from '../auth/rbac/roles/entities/roles.entity';
import { Workspaces } from '../workspaces/entities/workspaces.entity';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type InviteEmailResult = {
  via: 'gmail' | 'smtp' | null;
  /** Why it was not sent, in words the inviter can act on. */
  problem?: string;
};

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
    private readonly moduleRef?: ModuleRef,
  ) {}

  private readonly logger = new Logger(TenantMembersService.name);

  /** AuthModule imports this module, so GmailService is looked up lazily rather than injected. */
  private gmail(): GmailService | null {
    try {
      return this.moduleRef?.get(GmailService, { strict: false }) ?? null;
    } catch {
      return null;
    }
  }

  /** Roles belong to one organization; a role from another one can't be handed out here. */
  private async assertRoleInTenant(roleId: string, tenantId: string): Promise<void> {
    const role = await this.repo.manager
      .getRepository(Roles)
      .findOne({ where: { id: roleId }, select: { id: true, tenantId: true } });
    if (!role || role.tenantId !== tenantId) {
      throw new BadRequestException("Choose one of this organization's roles");
    }
  }

  /** De-duplicates workspace ids and checks they all belong to the tenant; empty means all workspaces. */
  async cleanWorkspaceIds(
    ids: string[] | null | undefined,
    tenantId: string,
  ): Promise<string[] | null> {
    if (!ids?.length) return null;
    const unique = [...new Set(ids)];
    const found = await this.repo.manager.getRepository(Workspaces).find({
      where: { id: In(unique), tenantId },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      throw new BadRequestException("One of those workspaces isn't in this organization");
    }
    return unique;
  }

  /**
   * Sends the invitation from the inviter's connected Gmail, so it arrives from a
   * real person's address. Falls back to SMTP only if the server has it set up.
   */
  private async sendInviteEmail(params: {
    to: string;
    workspaceName: string;
    acceptLink: string;
    hasAccount: boolean;
    invitedBy: string;
  }): Promise<InviteEmailResult> {
    const inviter = await this.userService.findOne({ id: params.invitedBy });
    const inviterName =
      [inviter?.firstName, inviter?.lastName].filter(Boolean).join(' ') || null;
    const content = this.mailService.workspaceInviteContent({ ...params, inviterName });

    let problem: string | undefined;
    const gmail = this.gmail();
    if (gmail) {
      try {
        await gmail.sendEmailAsUser(params.invitedBy, params.to, content.subject, content.text, content.html);
        return { via: 'gmail' };
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Invite to ${params.to} not sent from Gmail: ${reason}`);
        problem = /not connected|no email/i.test(reason)
          ? 'Connect your Gmail on the Email page so invitations send from your address.'
          : /expired|re-authenticate|invalid_grant|insufficient/i.test(reason)
            ? 'Your Gmail connection has expired. Reconnect it on the Email page.'
            : 'Gmail would not send the invitation. Try reconnecting Gmail on the Email page.';
      }
    } else {
      problem = 'Gmail sending is not available on this server.';
    }

    if (this.mailService.isSmtpConfigured()) {
      const sent = await this.mailService.sendWorkspaceInviteEmail(
        params.to,
        params.workspaceName,
        params.acceptLink,
        params.hasAccount,
        inviterName,
      );
      if (sent) return { via: 'smtp' };
    }
    return { via: null, problem };
  }

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
      workspaceIds: inv.workspaceIds ?? null,
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
          workspaceIds: member.workspaceIds ?? null,
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
      workspaceIds: inv.workspaceIds,
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
    /** Workspaces they'll be able to use; empty or missing means all of them. */
    workspaceIds?: string[] | null;
  }): Promise<{
    message: string;
    invitation: TenantMemberInvitation;
    pending: true;
    emailSent: boolean;
    emailVia: 'gmail' | 'smtp' | null;
    /** Only when the email could not be sent, so the inviter can pass it on. */
    acceptLink?: string;
    emailProblem?: string;
  }> {
    const email = this.normalizeEmail(params.email);
    await this.assertRoleInTenant(params.roleId, params.tenantId);
    const workspaceIds = await this.cleanWorkspaceIds(params.workspaceIds, params.tenantId);
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
      pending.workspaceIds = workspaceIds;
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
          workspaceIds,
        }),
      );
    }

    const tenant = await this.tenantsRepo.findOne({
      where: { id: params.tenantId },
    });
    const frontendUrl = resolveFrontendUrl(this.config);
    const acceptLink = `${frontendUrl}/invite?id=${invitation.id}&token=${this.invitationToken(invitation.id)}`;

    const sent = await this.sendInviteEmail({
      to: email,
      workspaceName: tenant?.name ?? 'Workspace',
      acceptLink,
      hasAccount: Boolean(user),
      invitedBy: params.invitedBy,
    });

    if (!sent.via) {
      // The link only works for someone signed in as the invited email, so the
      // inviter can safely send it themselves.
      return {
        message: `The invitation to ${email} is saved but was not emailed. ${sent.problem ?? ''} In the meantime, copy the link and send it to them.`.replace(/\s+/g, ' '),
        invitation,
        pending: true,
        emailSent: false,
        emailVia: null,
        acceptLink,
        emailProblem: sent.problem,
      };
    }

    return {
      message: user
        ? 'Invitation sent — they need to accept it from the email before they join.'
        : 'Invitation sent — they can create an account from the email to join.',
      invitation,
      pending: true,
      emailSent: true,
      emailVia: sent.via,
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
      existing.workspaceIds = inv.workspaceIds ?? null;
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
          workspaceIds: inv.workspaceIds ?? null,
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

  /**
   * Changes a member's role, whether they're active, or which workspaces they can use.
   * Who the membership belongs to (user and organization) never changes here.
   */
  async update(
    id: string,
    dto: Pick<TenantMembersUpdateDto, 'roleId' | 'isActive'> & { workspaceIds?: string[] | null },
  ): Promise<TenantMembers> {
    const member = await this.findOne(id);
    if (dto.roleId !== undefined) {
      await this.assertRoleInTenant(dto.roleId, member.tenantId);
      member.roleId = dto.roleId;
    }
    if (dto.isActive !== undefined) member.isActive = dto.isActive;
    if (dto.workspaceIds !== undefined) {
      const next = await this.cleanWorkspaceIds(dto.workspaceIds, member.tenantId);
      const tenant = await this.tenantsRepo.findOne({
        where: { id: member.tenantId },
        select: { id: true, ownerId: true },
      });
      if (next && tenant?.ownerId === member.userId) {
        throw new BadRequestException("The organization's owner always has every workspace");
      }
      member.workspaceIds = next;
    }
    await this.repo.save(member);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (res.affected === 0)
      throw new NotFoundException('TenantMembers not found');
  }
}
