import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocialInsights } from './entities/social_insights.entity';
import { PageInsightsService } from './page-insights.service';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { AnalyticsController } from './analytics.controller';
import { AiAnalyticsService } from './ai-analytics.service';
import { BrandProfiles } from '../brand_profiles/entities/brand_profiles.entity';
import { ContentPublications } from '../content_publications/entities/content_publications.entity';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SocialInsights, SocialAccounts, BrandProfiles, ContentPublications]),
    AiModule,
  ],
  controllers: [AnalyticsController],
  providers: [PageInsightsService, AiAnalyticsService],
  exports: [PageInsightsService],
})
export class AnalyticsModule {}
