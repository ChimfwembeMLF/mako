import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentPublications } from '../content_publications/entities/content_publications.entity';
import { ContentItems } from '../content_items/entities/content_items.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { isContentDue } from '../content_items/utils/schedule.util';

export type TenantUserRef = { tenantId: string; userId: string };

@Injectable()
export class TenantQueueFanoutService {
  constructor(
    @InjectRepository(ContentPublications)
    private readonly publicationsRepo: Repository<ContentPublications>,
    @InjectRepository(ContentItems)
    private readonly contentRepo: Repository<ContentItems>,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  /** Tenants with published posts that may need comment sync. */
  async listTenantsForCommentSync(): Promise<TenantUserRef[]> {
    const pubs = await this.publicationsRepo.find({
      where: { status: 'published' },
      order: { publishedAt: 'DESC' },
    });

    const seen = new Map<string, string>();
    for (const pub of pubs) {
      if (!pub.externalPostId || seen.has(pub.tenantId)) continue;
      seen.set(pub.tenantId, pub.userId);
    }
    return [...seen.entries()].map(([tenantId, userId]) => ({
      tenantId,
      userId,
    }));
  }

  /** Distinct tenants with approved content due for auto-publish. */
  async listTenantsForAutoPublish(): Promise<string[]> {
    const items = await this.contentRepo.find({
      where: { status: 'approved' },
    });
    const tenantIds = new Set<string>();
    for (const item of items) {
      if (isContentDue(item)) tenantIds.add(item.tenantId);
    }
    return [...tenantIds];
  }

  async listTenantsForDailyWorkflow(): Promise<string[]> {
    return this.subscriptions.findEligibleForDailyCron();
  }
}
