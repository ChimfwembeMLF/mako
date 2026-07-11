import { Controller, Get, Req, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiAnalyticsService, AiAnalyticsReport } from './ai-analytics.service';
import { PageInsightsService } from './page-insights.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SocialInsights } from './entities/social_insights.entity';

@Controller('api/v1/analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(
    private readonly aiAnalytics: AiAnalyticsService,
    private readonly pageInsights: PageInsightsService,
    @InjectRepository(SocialInsights)
    private readonly insightsRepo: Repository<SocialInsights>,
  ) {}

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
