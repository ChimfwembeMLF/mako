import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutoReplyRules } from './entities/auto_reply_rules.entity';
import { Tenants } from '../tenants/entities/tenants.entity';
import { DEFAULT_AUTO_REPLY_RULE_SEEDS } from './auto-reply-seeds.constants';

@Injectable()
export class AutoReplySeedService implements OnModuleInit {
  private readonly logger = new Logger(AutoReplySeedService.name);

  constructor(
    @InjectRepository(AutoReplyRules)
    private readonly repo: Repository<AutoReplyRules>,
    @InjectRepository(Tenants)
    private readonly tenantsRepo: Repository<Tenants>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.AUTO_REPLY_BACKFILL_ON_START === 'false') return;
    const created = await this.backfillTenantsWithNoRules();
    if (created > 0) {
      this.logger.log(
        `Startup backfill: created ${created} default auto-reply rule(s) for tenants with none`,
      );
    }
  }

  async countForTenant(tenantId: string): Promise<number> {
    return this.repo.count({ where: { tenantId } });
  }

  /** Idempotent — adds any missing default rules by platform + name. */
  async ensureSeededForTenant(tenantId: string): Promise<number> {
    let created = 0;

    for (const seed of DEFAULT_AUTO_REPLY_RULE_SEEDS) {
      const existing = await this.repo.findOne({
        where: { tenantId, platform: seed.platform, name: seed.name },
      });
      if (existing) continue;

      await this.repo.save(
        this.repo.create({
          tenantId,
          platform: seed.platform,
          name: seed.name,
          triggerKeywords: seed.triggerKeywords ?? [],
          triggerSentiment: seed.triggerSentiment ?? 'any',
          responseTemplate: seed.responseTemplate,
          aiGenerate: seed.aiGenerate,
          isActive: seed.isActive,
        }),
      );
      created++;
    }

    if (created > 0) {
      this.logger.log(
        `Seeded ${created} auto-reply rules for tenant ${tenantId}`,
      );
    }
    return created;
  }

  /** Backfill tenants that have zero auto-reply rules (existing accounts). */
  async backfillTenantsWithNoRules(): Promise<number> {
    const tenants = await this.tenantsRepo.find({ select: ['id'] });
    let totalCreated = 0;

    for (const tenant of tenants) {
      totalCreated += await this.ensureSeededForTenant(tenant.id);
    }

    return totalCreated;
  }
}
