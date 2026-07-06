import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AdsService } from './services/ads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdPlatform } from './entities/ad-campaign.entity';
import { Request } from 'express';

interface CreateCampaignDto {
  tenantId: string;
  name: string;
  platform: AdPlatform;
  dailyBudget: number;
  targetAudience: string;
  prompt: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  ageRange?: string;
  targetUrl?: string;
  launch?: boolean;
}

@ApiTags('Ads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/ads')
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  private userId(req: Request): string {
    return req.user?.['sub'] as string;
  }

  @Post('campaigns')
  @ApiOperation({ summary: 'Draft a new AI Ad Campaign' })
  async createCampaign(@Req() req: Request, @Body() dto: CreateCampaignDto) {
    const userId = this.userId(req);
    if (dto.launch) {
      return this.adsService.createAndLaunchCampaign(userId, dto.tenantId, dto);
    }
    return this.adsService.createCampaign(userId, dto.tenantId, dto);
  }

  @Post('campaigns/:id/publish')
  @ApiOperation({ summary: 'Publish a draft campaign to the actual Ad Platform' })
  async publishCampaign(
    @Req() req: Request,
    @Body('tenantId') tenantId: string,
    @Param('id') campaignId: string,
  ) {
    return this.adsService.publishCampaign(
      this.userId(req),
      tenantId,
      campaignId,
    );
  }

  @Post('campaigns/:id/pause')
  @ApiOperation({ summary: 'Pause an active campaign' })
  async pauseCampaign(
    @Req() req: Request,
    @Body('tenantId') tenantId: string,
    @Param('id') campaignId: string,
  ) {
    return this.adsService.pauseCampaign(
      this.userId(req),
      tenantId,
      campaignId,
    );
  }

  @Get('campaigns')
  @ApiOperation({ summary: 'List all ad campaigns' })
  async getCampaigns(
    @Req() req: Request,
    @Query('tenantId') tenantId: string,
  ) {
    return this.adsService.getCampaigns(this.userId(req), tenantId);
  }

  @Get('dashboard-stats')
  @ApiOperation({ summary: 'Aggregate ads dashboard metrics' })
  async getDashboardStats(
    @Req() req: Request,
    @Query('tenantId') tenantId: string,
  ) {
    return this.adsService.getDashboardStats(this.userId(req), tenantId);
  }

  @Get('campaigns/:id/metrics')
  @ApiOperation({ summary: 'Get real-time metrics for an active campaign' })
  async getCampaignMetrics(
    @Req() req: Request,
    @Query('tenantId') tenantId: string,
    @Param('id') campaignId: string,
  ) {
    return this.adsService.getCampaignMetrics(
      this.userId(req),
      tenantId,
      campaignId,
    );
  }

  @Get('campaigns/:id/embed-script')
  @ApiOperation({ summary: 'Get embed script snippet for self-hosted ads' })
  async getEmbedScript(
    @Req() req: Request,
    @Query('tenantId') tenantId: string,
    @Param('id') campaignId: string,
  ) {
    return this.adsService.getEmbedScript(
      this.userId(req),
      tenantId,
      campaignId,
    );
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get current ads balance for tenant' })
  async getBalance(
    @Req() req: Request,
    @Query('tenantId') tenantId: string,
  ) {
    return this.adsService.getBalance(this.userId(req), tenantId);
  }

  @Post('ai-assist')
  @ApiOperation({ summary: 'Generate AI assist content for Ads' })
  async generateCampaignAssist(
    @Req() req: Request,
    @Body() body: { tenantId: string; prompt: string; platform?: string },
  ) {
    return this.adsService.generateCampaignAssist(
      this.userId(req),
      body.tenantId,
      body.prompt,
      body.platform,
    );
  }
}
