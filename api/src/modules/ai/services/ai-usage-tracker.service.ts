import { Injectable, ForbiddenException } from '@nestjs/common';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { AiUsageService } from '../../ai_usage/ai_usage.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantIntegrationConfig, IntegrationProvider } from '../../tenants/entities/tenant-integration-config.entity';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class AiUsageTrackerService {
  constructor(
    private readonly aiUsage: AiUsageService,
    private readonly subscriptions: SubscriptionsService,
    @InjectRepository(TenantIntegrationConfig)
    private readonly configRepo: Repository<TenantIntegrationConfig>,
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
    const customConfig = await this.configRepo.findOne({
      where: { tenantId, provider: IntegrationProvider.MISTRAL },
    });
    
    if (customConfig) {
      // User brought their own key, bypass platform billing limits
      return;
    }

    await this.subscriptions.assertCanUseAi(tenantId);
  }
}
