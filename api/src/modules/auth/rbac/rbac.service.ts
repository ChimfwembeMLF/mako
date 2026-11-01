import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TenantMembers } from '../../tenant_members/entities/tenant_members.entity';
import { Roles } from './roles/entities/roles.entity';
import { RolePermissions } from './role_permissions/entities/role_permissions.entity';
import { UserPermissions } from './user_permissions/entities/user_permissions.entity';
import { Profiles } from '../../profiles/entities/profiles.entity';
import { UserEntity } from '../../user/user.entity';
import { RoleType } from '../../../constants';
import { SUPER_ADMIN_PERMISSIONS } from './rbac.constants';

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(TenantMembers)
    private readonly membersRepo: Repository<TenantMembers>,
    @InjectRepository(Roles)
    private readonly rolesRepo: Repository<Roles>,
    @InjectRepository(RolePermissions)
    private readonly rolePermissionsRepo: Repository<RolePermissions>,
    @InjectRepository(UserPermissions)
    private readonly userPermissionsRepo: Repository<UserPermissions>,
    @InjectRepository(Profiles)
    private readonly profilesRepo: Repository<Profiles>,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
  ) {}

  async hasRoles(
    userId: string,
    tenantId: string,
    requiredRoles: string[],
  ): Promise<boolean> {
    if (!requiredRoles?.length) return false;
    const member = await this.membersRepo.findOne({
      where: { userId, tenantId, isActive: true },
    });
    if (!member) return false;
    const role = await this.rolesRepo.findOne({ where: { id: member.roleId } });
    if (!role) return false;
    return requiredRoles.includes(role.name);
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    const profile = await this.profilesRepo.findOne({ where: { userId } });
    if (profile?.isSystemAdmin === true) return true;
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    return user?.role === RoleType.SUPER_ADMIN;
  }

  async canAccessTenant(userId: string, tenantId: string): Promise<boolean> {
    const member = await this.membersRepo.findOne({
      where: { userId, tenantId, isActive: true },
    });
    return Boolean(member) || this.isSuperAdmin(userId);
  }

  async memberTenantIds(userId: string): Promise<string[]> {
    const memberships = await this.membersRepo.find({
      where: { userId, isActive: true },
    });
    return memberships.map((m) => m.tenantId);
  }

  async sharesTenant(userId: string, otherUserId: string): Promise<boolean> {
    const memberships = await this.membersRepo.find({
      where: { userId, isActive: true },
    });
    if (!memberships.length) return false;
    const shared = await this.membersRepo.count({
      where: {
        userId: otherUserId,
        isActive: true,
        tenantId: In(memberships.map((m) => m.tenantId)),
      },
    });
    return shared > 0;
  }

  async hasPermission(
    userId: string,
    tenantId: string,
    permissionName: string,
  ): Promise<boolean> {
    const effective = await this.getEffectivePermissions(userId, tenantId);
    return effective.permissions.includes(permissionName);
  }

  async getEffectivePermissions(
    userId: string,
    tenantId: string,
  ): Promise<{
    permissions: string[];
    isSystemAdmin: boolean;
    isSuperAdmin: boolean;
    roleId: string | null;
    roleName: string | null;
  }> {
    const profile = await this.profilesRepo.findOne({ where: { userId } });
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    const isSuperAdmin =
      profile?.isSystemAdmin === true || user?.role === RoleType.SUPER_ADMIN;
    const isSystemAdmin = isSuperAdmin;

    const member = await this.membersRepo.findOne({
      where: { userId, tenantId, isActive: true },
    });

    if (!member) {
      return {
        permissions: [],
        isSystemAdmin,
        isSuperAdmin,
        roleId: null,
        roleName: null,
      };
    }

    const role = await this.rolesRepo.findOne({ where: { id: member.roleId } });
    const rolePerms = await this.rolePermissionsRepo.find({
      where: { roleId: member.roleId },
    });

    const granted = new Set(rolePerms.map((rp) => rp.permissionKey));

    const now = new Date();
    const overrides = await this.userPermissionsRepo.find({
      where: { userId, tenantId },
    });

    for (const override of overrides) {
      if (override.validFrom && override.validFrom > now) continue;
      if (override.validUntil && override.validUntil < now) continue;
      if (override.effect === 'allow') granted.add(override.permissionKey);
      if (override.effect === 'deny') granted.delete(override.permissionKey);
    }

    if (isSuperAdmin) {
      for (const key of SUPER_ADMIN_PERMISSIONS) {
        granted.add(key);
      }
    }

    return {
      permissions: Array.from(granted),
      isSystemAdmin,
      isSuperAdmin,
      roleId: role?.id ?? null,
      roleName: role?.name ?? null,
    };
  }
}
