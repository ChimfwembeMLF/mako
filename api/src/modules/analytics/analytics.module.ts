import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocialInsights } from './entities/social_insights.entity';
import { PageInsightsService } from './page-insights.service';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { AnalyticsController } from './analytics.controller';
import { AiAnalyticsService } from './ai-analytics.service';
import { BrandProfiles } from '../brand_profiles/entities/brand_profiles.entity';
import { ContentPublications } from '../content_publications/entities/content_publications.entity';
import { CommentReplies } from '../comment_replies/entities/comment_replies.entity';
import { ContentItems } from '../content_items/entities/content_items.entity';
import { AiModule } from '../ai/ai.module';
import { PlatformDashboardService } from './platform-dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SocialInsights,
      SocialAccounts,
      BrandProfiles,
      ContentPublications,
      CommentReplies,
      ContentItems,
    ]),
    AiModule,
  ],
  controllers: [AnalyticsController],
  providers: [PageInsightsService, AiAnalyticsService, PlatformDashboardService],
  exports: [PageInsightsService, PlatformDashboardService],
})
export class AnalyticsModule {}
