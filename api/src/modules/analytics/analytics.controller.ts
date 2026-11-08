import { RequirePermission } from '../auth/rbac/require-permission.decorator';
import { Controller, Get, Req, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiAnalyticsService, AiAnalyticsReport } from './ai-analytics.service';
import { PageInsightsService } from './page-insights.service';
import { PlatformDashboardService } from './platform-dashboard.service';
import { PerformanceService, PerformanceReport } from './performance.service';
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
    private readonly performance: PerformanceService,
    @InjectRepository(SocialInsights)
    private readonly insightsRepo: Repository<SocialInsights>,
  ) {}

  @RequirePermission('analytics.view')
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

  @RequirePermission('analytics.view')
  @Get('performance')
  getPerformance(
    @Req() req: any,
    @Query('days') days = '30',
    @Query('tenantId') queryTenantId?: string,
    @Query('workspaceId') workspaceId?: string,
  ): Promise<PerformanceReport | null> {
    const tenantId = queryTenantId || req.user?.tenantId;
    if (!tenantId) return Promise.resolve(null);
    return this.performance.getReport(tenantId, workspaceId, Number(days));
  }

  @RequirePermission('analytics.view')
  @Get('insights')
  async getInsights(
    @Req() req: any,
    @Query('days') days = 30,
    @Query('tenantId') queryTenantId?: string,
    @Query('workspaceId') workspaceId?: string,
  ): Promise<SocialInsights[]> {
    // The account being viewed, not the one in the login token; access is checked by TenantScopeInterceptor.
    const tenantId = queryTenantId || req.user?.tenantId;
    if (!tenantId) return [];

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Math.min(365, Math.max(1, Number(days) || 30)));

    const query = this.insightsRepo
      .createQueryBuilder('insights')
      .where('insights.tenantId = :tenantId', { tenantId })
      .andWhere('insights.date >= :startDate', { startDate });

    if (workspaceId) {
      query.andWhere('insights.workspaceId = :workspaceId', { workspaceId });
    }

    return query.orderBy('insights.date', 'ASC').getMany();
  }

  @RequirePermission('analytics.view')
  @Get('ai-report')
  async getAiReport(
    @Req() req: any,
    @Query('tenantId') queryTenantId?: string,
    @Query('workspaceId') workspaceId?: string,
  ): Promise<AiAnalyticsReport | null> {
    const tenantId = queryTenantId || req.user?.tenantId;
    if (!tenantId) return null;
    return this.aiAnalytics.generateReport(tenantId, workspaceId);
  }
}
