import { ForbiddenException, Injectable } from '@nestjs/common';
import { RbacService } from '../../auth/rbac/rbac.service';

/** Tenant routes take the tenant id from the URL, so membership has to be checked per request. */
@Injectable()
export class TenantAccessService {
  constructor(private readonly rbac: RbacService) {}

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

  async assertSuperAdmin(userId: string): Promise<void> {
    const { isSuperAdmin } = await this.rbac.getEffectivePermissions(userId, '');
    if (!isSuperAdmin) {
      throw new ForbiddenException('Platform admin privileges required');
    }
  }
}
