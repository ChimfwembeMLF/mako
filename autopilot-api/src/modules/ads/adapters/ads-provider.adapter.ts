import { AdPlatform } from '../entities/ad-campaign.entity';
import { AdsPublishPayload } from './ads-provider.types';

export interface AdMetrics {
  spend: number;
  impressions: number;
  clicks: number;
}

export interface AdsProviderAdapter {
  platform: AdPlatform;
  createCampaign(tenantId: string, payload: AdsPublishPayload): Promise<string>;
  pauseCampaign(
    tenantId: string,
    platformCampaignId: string,
    payload?: AdsPublishPayload,
  ): Promise<void>;
  getMetrics(
    tenantId: string,
    platformCampaignId: string,
    payload?: AdsPublishPayload,
  ): Promise<AdMetrics>;
}
