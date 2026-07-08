import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { AiUsageService } from '../../ai_usage/ai_usage.service';

/**
 * Guard that checks AI usage limits for the current tenant/user.
 * It delegates to AiUsageService which tracks token/usage counts.
 */
@Injectable()
export class UsageGateGuard implements CanActivate {
  constructor(private readonly aiUsageService: AiUsageService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const tenantId = user?.tenantId;
    const userId = user?.sub;
    const allowed = await this.aiUsageService.checkUsage(tenantId, userId);
    if (!allowed) {
      throw new ForbiddenException('AI usage limit exceeded');
    }
    return true;
  }
}
