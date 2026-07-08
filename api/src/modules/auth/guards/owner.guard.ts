import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Guard that ensures the request is made by the tenant owner (system_admin flag).
 */
@Injectable()
export class OwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.isOwner) {
      throw new ForbiddenException('Owner privileges required');
    }
    return true;
  }
}
