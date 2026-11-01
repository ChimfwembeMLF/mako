import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Roles } from './roles/entities/roles.entity';
import { BACKOFFICE_ONLY_PERMISSIONS } from './rbac.constants';
import { RbacService } from './rbac.service';

/** Tenant routes take the tenant id from the request, so access has to be checked per request. */
@Injectable()
export class TenantAccessService {
  constructor(
    private readonly rbac: RbacService,
    @InjectRepository(Roles)
    private readonly rolesRepo: Repository<Roles>,
  ) {}

  async assertMember(
    userId: string,
    tenantId: string,
    permission?: string,
  ): Promise<void> {
    const access = await this.rbac.getEffectivePermissions(userId, tenantId);
    if (access.isSuperAdmin) return;
    if (!access.roleId) {
      throw new ForbiddenException('You are not a member of this workspace');
    }
    if (permission && !access.permissions.includes(permission)) {
      throw new ForbiddenException('You do not have permission to do this');
    }
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    return this.rbac.isSuperAdmin(userId);
  }

  async assertSuperAdmin(userId: string): Promise<void> {
    if (!(await this.isSuperAdmin(userId))) {
      throw new ForbiddenException('Platform admin privileges required');
    }
  }

  /** Someone can look up themselves, and people they share a tenant with. */
  async assertCanViewUser(viewerId: string, userId: string): Promise<void> {
    if (viewerId === userId || (await this.isSuperAdmin(viewerId))) return;
    if (!(await this.rbac.sharesTenant(viewerId, userId))) {
      throw new ForbiddenException('You do not have access to this user');
    }
  }

  /** Permissions reserved for the platform can't be handed out by a tenant. */
  async assertCanGrant(userId: string, permissionKey?: string): Promise<void> {
    const reserved = (BACKOFFICE_ONLY_PERMISSIONS as readonly string[]).includes(
      permissionKey ?? '',
    );
    if (reserved) await this.assertSuperAdmin(userId);
  }

  async assertCanManageRole(
    userId: string,
    roleId: string,
    permissionKey?: string,
  ): Promise<void> {
    const role = await this.rolesRepo.findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');
    await this.assertMember(userId, role.tenantId, 'admin.roles');
    await this.assertCanGrant(userId, permissionKey);
  }
}
