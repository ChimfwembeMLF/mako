import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacService } from '../rbac/rbac.service';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard that enforces required roles defined via @Roles() decorator.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // no roles required
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const has = await this.rbac.hasRoles(
      user.sub,
      user.tenantId,
      requiredRoles,
    );
    if (!has) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
