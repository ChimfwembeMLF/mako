import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Guard that ensures the request's tenantId matches the tenantId claim in the JWT.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userTenant = request.user?.tenantId;
    const routeTenant = request.params?.tenantId;
    if (!userTenant || !routeTenant || userTenant !== routeTenant) {
      throw new ForbiddenException('Tenant mismatch');
    }
    return true;
  }
}
