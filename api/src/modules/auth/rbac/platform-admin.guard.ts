import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { TenantAccessService } from './tenant-access.service';

/** Use after JwtAuthGuard. For records no tenant should reach directly. */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly access: TenantAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context.switchToHttp().getRequest();
    await this.access.assertSuperAdmin(String(user?.sub ?? ''));
    return true;
  }
}
