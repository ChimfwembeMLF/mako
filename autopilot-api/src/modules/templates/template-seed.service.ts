import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentTemplates } from './entities/content_templates.entity';
import { DEFAULT_CONTENT_TEMPLATE_SEEDS } from './template-seeds.constants';

@Injectable()
export class TemplateSeedService {
  private readonly logger = new Logger(TemplateSeedService.name);

  constructor(
    @InjectRepository(ContentTemplates)
    private readonly repo: Repository<ContentTemplates>,
  ) {}

  async ensureSeededForTenant(tenantId: string, userId: string): Promise<number> {
    let created = 0;

    for (const seed of DEFAULT_CONTENT_TEMPLATE_SEEDS) {
      const existing = await this.repo.findOne({
        where: { tenantId, name: seed.name },
      });
      if (existing) continue;

      await this.repo.save(
        this.repo.create({
          tenantId,
          userId,
          name: seed.name,
          description: seed.description,
          contentType: seed.contentType,
          body: seed.body,
          platforms: seed.platforms,
          isActive: true,
        }),
      );
      created++;
    }

    if (created > 0) {
      this.logger.log(`Seeded ${created} content templates for tenant ${tenantId}`);
    }
    return created;
  }

}
