import { Controller, Get, Req, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiAnalyticsService, AiAnalyticsReport } from './ai-analytics.service';
import { PageInsightsService } from './page-insights.service';
import { PlatformDashboardService } from './platform-dashboard.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SocialInsights } from './entities/social_insights.entity';

@Controller('api/v1/analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(
    private readonly aiAnalytics: AiAnalyticsService,
    private readonly pageInsights: PageInsightsService,
    private readonly platformDashboard: PlatformDashboardService,
    @InjectRepository(SocialInsights)
    private readonly insightsRepo: Repository<SocialInsights>,
  ) {}

  @Get('platform-dashboard')
  getPlatformDashboard(
    @Query('tenantId') tenantId: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    if (!tenantId) {
      return {
        platforms: [],
        totals: {
          connectedPlatforms: 0,
          publishedPosts: 0,
          scheduledPosts: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          views: 0,
          engagementScore: 0,
          pendingReplies: 0,
          followers: 0,
          reach: 0,
          impressions: 0,
        },
      };
    }
    return this.platformDashboard.getDashboard(tenantId, workspaceId);
  }

  @Get('insights')
  async getInsights(
    @Req() req: any,
    @Query('days') days = 30,
  ): Promise<SocialInsights[]> {
    const { tenantId, workspaceId } = req.user;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const query = this.insightsRepo
      .createQueryBuilder('insights')
      .where('insights.tenantId = :tenantId', { tenantId })
      .andWhere('insights.date >= :startDate', { startDate });

    if (workspaceId) {
      query.andWhere('insights.workspaceId = :workspaceId', { workspaceId });
    }

    return query.orderBy('insights.date', 'ASC').getMany();
  }

  @Get('ai-report')
  async getAiReport(@Req() req: any): Promise<AiAnalyticsReport | null> {
    const { tenantId, workspaceId } = req.user;
    return this.aiAnalytics.generateReport(tenantId, workspaceId);
  }
}
