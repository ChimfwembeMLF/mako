import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenants } from './entities/tenants.entity';
import { UserEntity } from '../user/user.entity';
import { Profiles } from '../profiles/entities/profiles.entity';
import { TenantMembers } from '../tenant_members/entities/tenant_members.entity';
import { Roles } from '../auth/rbac/roles/entities/roles.entity';
import { Permissions } from '../auth/rbac/permissions/entities/permissions.entity';
import { RolePermissions } from '../auth/rbac/role_permissions/entities/role_permissions.entity';
import { Workspaces } from '../workspaces/entities/workspaces.entity';
import { ApprovalWorkflows } from '../approval_workflows/entities/approval_workflows.entity';
import {
  PERMISSION_DEFINITIONS,
  SYSTEM_ROLE_DEFINITIONS,
  APPROVAL_WORKFLOW_DEFINITIONS,
  TENANT_SCOPED_PERMISSIONS,
} from '../auth/rbac/rbac.constants';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TemplateSeedService } from '../templates/template-seed.service';
import { AutoReplySeedService } from '../auto_reply_rules/auto-reply-seed.service';
import { BrandProfileSeedService } from '../brand_profiles/brand-profile-seed.service';

@Injectable()
export class TenantBootstrapService {
  private readonly logger = new Logger(TenantBootstrapService.name);

  constructor(
    @InjectRepository(Tenants)
    private readonly tenantsRepo: Repository<Tenants>,
    @InjectRepository(Profiles)
    private readonly profilesRepo: Repository<Profiles>,
    @InjectRepository(TenantMembers)
    private readonly membersRepo: Repository<TenantMembers>,
    @InjectRepository(Roles) private readonly rolesRepo: Repository<Roles>,
    @InjectRepository(Permissions)
    private readonly permissionsRepo: Repository<Permissions>,
    @InjectRepository(RolePermissions)
    private readonly rolePermissionsRepo: Repository<RolePermissions>,
    @InjectRepository(Workspaces)
    private readonly workspacesRepo: Repository<Workspaces>,
    @InjectRepository(ApprovalWorkflows)
    private readonly workflowsRepo: Repository<ApprovalWorkflows>,
    private readonly subscriptions: SubscriptionsService,
    private readonly templateSeeds: TemplateSeedService,
    private readonly autoReplySeeds: AutoReplySeedService,
    private readonly brandProfileSeeds: BrandProfileSeedService,
  ) {}

  async ensurePermissionsSeeded(): Promise<void> {
    await this.permissionsRepo.upsert(
      PERMISSION_DEFINITIONS.map((perm) => ({
        key: perm.key,
        label: perm.label,
        module: perm.module,
        description: perm.description,
      })),
      ['key'],
    );

    const roleChatbotKeys: Record<string, string[]> = {
      Owner: ['chatbot.view', 'chatbot.use', 'chatbot.manage'],
      Admin: ['chatbot.view', 'chatbot.use', 'chatbot.manage'],
      Publisher: ['chatbot.view', 'chatbot.use'],
    };
    for (const [roleName, keys] of Object.entries(roleChatbotKeys)) {
      const roles = await this.rolesRepo.find({ where: { name: roleName } });
      for (const role of roles) {
        for (const permissionKey of keys) {
          const exists = await this.rolePermissionsRepo.findOne({
            where: { roleId: role.id, permissionKey },
          });
          if (!exists) {
            await this.rolePermissionsRepo.save(
              this.rolePermissionsRepo.create({
                roleId: role.id,
                permissionKey,
              }),
            );
          }
        }
      }
    }
  }

  async bootstrapForUser(user: UserEntity): Promise<Tenants> {
    await this.ensurePermissionsSeeded();

    const memberships = await this.membersRepo.find({
      where: { userId: user.id },
    });
    if (memberships.length) {
      for (const membership of memberships) {
        await this.seedTenantDefaults(membership.tenantId, user);
      }
      const tenant = await this.tenantsRepo.findOneOrFail({
        where: { id: memberships[0].tenantId },
      });
      return tenant;
    }

    await this.ensureProfile(user);

    const slugBase = (
      user.email?.split('@')[0] ??
      user.firstName ??
      `user-${user.id.slice(0, 8)}`
    )
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const slug = `${slugBase}-${Date.now().toString(36)}`;

    const workspaceLabel =
      user.firstName?.trim() || user.email?.split('@')[0] || 'My';

    const tenant = await this.tenantsRepo.save(
      this.tenantsRepo.create({
        name: `${workspaceLabel}'s Workspace`,
        slug,
        ownerId: user.id,
      }),
    );

    const roleMap = new Map<string, Roles>();
    for (const roleDef of SYSTEM_ROLE_DEFINITIONS) {
      const role = await this.rolesRepo.save(
        this.rolesRepo.create({
          tenantId: tenant.id,
          name: roleDef.name,
          description: roleDef.description,
          isSystem: true,
        }),
      );
      roleMap.set(roleDef.name, role);

      const keys =
        roleDef.permissions === '*'
          ? TENANT_SCOPED_PERMISSIONS
          : roleDef.permissions;

      for (const permissionKey of keys) {
        await this.rolePermissionsRepo.save(
          this.rolePermissionsRepo.create({ roleId: role.id, permissionKey }),
        );
      }
    }

    const ownerRole = roleMap.get('Owner')!;
    await this.membersRepo.save(
      this.membersRepo.create({
        tenantId: tenant.id,
        userId: user.id,
        roleId: ownerRole.id,
        isActive: true,
        invitedBy: user.id,
        joinedAt: new Date(),
      }),
    );

    await this.workspacesRepo.save(
      this.workspacesRepo.create({
        tenantId: tenant.id,
        name: 'Default',
        slug: 'default',
      }),
    );

    for (const wf of APPROVAL_WORKFLOW_DEFINITIONS) {
      const approverRole = roleMap.get(wf.approverRoleName);
      if (!approverRole) continue;
      await this.workflowsRepo.save(
        this.workflowsRepo.create({
          tenantId: tenant.id,
          actionKey: wf.actionKey,
          label: wf.label,
          description: wf.description,
          isEnabled: false,
          approverRoleId: approverRole.id,
          updatedBy: user.id,
        }),
      );
    }

    this.logger.log(`Bootstrapped tenant ${tenant.id} for user ${user.id}`);
    await this.subscriptions.ensureForTenant(tenant.id, 'free');
    await this.seedTenantDefaults(tenant.id, user);
    return tenant;
  }

  /** Idempotent starter data for new and returning tenants. */
  async seedTenantDefaults(tenantId: string, user: UserEntity): Promise<void> {
    await this.templateSeeds.ensureSeededForTenant(tenantId, user.id);
    await this.autoReplySeeds.ensureSeededForTenant(tenantId);
    await this.brandProfileSeeds.ensureStarterForUser(tenantId, user);
  }

  /** Backfill defaults for every tenant the user belongs to. */
  async seedDefaultsForUserTenants(user: UserEntity): Promise<void> {
    const memberships = await this.membersRepo.find({
      where: { userId: user.id, isActive: true },
    });
    for (const membership of memberships) {
      await this.seedTenantDefaults(membership.tenantId, user);
    }
  }

  async ensureSubscriptionForExistingTenant(tenantId: string) {
    return this.subscriptions.ensureForTenant(tenantId, 'free');
  }

  private async ensureProfile(user: UserEntity): Promise<void> {
    const existing = await this.profilesRepo.findOne({
      where: { userId: user.id },
    });
    const displayName =
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      user.firstName ||
      user.email ||
      undefined;

    if (existing) {
      if (!existing.displayName && displayName) {
        existing.displayName = displayName;
        existing.fullName = displayName;
        if (user.avatar && !existing.avatarUrl)
          existing.avatarUrl = user.avatar;
        await this.profilesRepo.save(existing);
      }
      return;
    }

    await this.profilesRepo.save(
      this.profilesRepo.create({
        userId: user.id,
        displayName,
        fullName: displayName,
        avatarUrl: user.avatar,
        isSystemAdmin: false,
      }),
    );
  }
}
