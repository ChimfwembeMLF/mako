import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutoReplyRules } from './entities/auto_reply_rules.entity';
import { DEFAULT_AUTO_REPLY_RULE_SEEDS } from './auto-reply-seeds.constants';

@Injectable()
export class AutoReplySeedService {
  private readonly logger = new Logger(AutoReplySeedService.name);

  constructor(
    @InjectRepository(AutoReplyRules)
    private readonly repo: Repository<AutoReplyRules>,
  ) {}

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
}
