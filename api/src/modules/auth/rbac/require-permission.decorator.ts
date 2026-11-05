import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSION_KEY = 'requiredPermission';

/**
 * The caller's role in the request's tenant must grant this permission key
 * (see rbac.constants PERMISSION_DEFINITIONS). Enforced by TenantScopeInterceptor,
 * which also resolves the tenant from tenantId or @TenantResource. The tenant's
 * owner and platform super admins always pass.
 */
export const RequirePermission = (permission: string) =>
  SetMetadata(REQUIRED_PERMISSION_KEY, permission);
