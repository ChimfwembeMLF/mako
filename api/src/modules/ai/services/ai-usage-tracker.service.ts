import { Injectable, ForbiddenException } from '@nestjs/common';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { AiUsageService } from '../../ai_usage/ai_usage.service';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class AiUsageTrackerService {
  constructor(
    private readonly aiUsage: AiUsageService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async record(params: {
    tenantId: string;
    userId: string;
    functionName: string;
    tokensUsed: number;
  }): Promise<void> {
    if (!params.tenantId || !params.userId) return;
    // Widget visitors use ids like "widget:{visitorId}" — not valid ai_usage.user_id UUIDs
    if (!UUID_RE.test(params.userId)) return;
    await this.aiUsage.create({
      tenantId: params.tenantId,
      userId: params.userId,
      functionName: params.functionName,
      tokensUsed: String(Math.max(0, params.tokensUsed)),
    });
  }

  async assertWithinLimit(tenantId: string, _userId: string): Promise<void> {
    await this.subscriptions.assertCanUseAi(tenantId);
  }
}
