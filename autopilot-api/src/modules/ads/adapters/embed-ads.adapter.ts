import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdMetrics, AdsProviderAdapter } from './ads-provider.adapter';
import {
  AdPlatform,
  AdCampaignEntity,
  AdCampaignStatus,
} from '../entities/ad-campaign.entity';
import { AdsPublishPayload } from './ads-provider.types';

@Injectable()
export class EmbedAdsAdapter implements AdsProviderAdapter {
  platform = AdPlatform.EMBED;
  private readonly logger = new Logger(EmbedAdsAdapter.name);

  constructor(
    @InjectRepository(AdCampaignEntity)
    private readonly campaignRepo: Repository<AdCampaignEntity>,
  ) {}

  async createCampaign(
    tenantId: string,
    payload: AdsPublishPayload,
  ): Promise<string> {
    this.logger.log(`Creating EMBED Ad Campaign for tenant ${tenantId}`);
    if (!payload.campaign.targetUrl?.trim()) {
      throw new Error('Target URL is required for embed ads');
    }
    const hash = `widget_${Math.random()
      .toString(36)
      .substring(2, 10)}${Date.now().toString(36)}`;
    return hash;
  }

  async pauseCampaign(
    tenantId: string,
    platformCampaignId: string,
  ): Promise<void> {
    await this.campaignRepo.update(
      { tenantId, platformCampaignId },
      { status: AdCampaignStatus.PAUSED },
    );
  }

  async getMetrics(
    tenantId: string,
    platformCampaignId: string,
  ): Promise<AdMetrics> {
    const campaign = await this.campaignRepo.findOne({
      where: { tenantId, platformCampaignId },
    });

    return {
      spend: 0,
      impressions: campaign?.nativeImpressions || 0,
      clicks: campaign?.nativeClicks || 0,
    };
  }
}
