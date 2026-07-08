import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { ContentItemsModule } from '../content_items/content_items.module';
import { AuditLogsModule } from '../audit_logs/audit_logs.module';
import { AiModule } from '../ai/ai.module';
import { Leads } from '../leads/entities/leads.entity';
import { ContentTemplates } from '../templates/entities/content_templates.entity';
import { KnowledgeDocument } from '../chatbot/entities/knowledge-document.entity';
import { BrandProfiles } from '../brand_profiles/entities/brand_profiles.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Leads,
      ContentTemplates,
      KnowledgeDocument,
      BrandProfiles,
    ]),
    ContentItemsModule,
    AuditLogsModule,
    AiModule,
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
