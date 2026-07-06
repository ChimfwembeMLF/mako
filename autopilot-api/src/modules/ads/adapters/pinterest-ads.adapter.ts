import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { AdMetrics, AdsProviderAdapter } from './ads-provider.adapter';
import { AdPlatform } from '../entities/ad-campaign.entity';
import { AdsAccountService } from '../services/ads-account.service';
import { AdsPublishPayload } from './ads-provider.types';

@Injectable()
export class PinterestAdsAdapter implements AdsProviderAdapter {
  platform = AdPlatform.PINTEREST;
  private readonly logger = new Logger(PinterestAdsAdapter.name);
  private readonly apiBase = 'https://api.pinterest.com/v5';

  constructor(private readonly adsAccount: AdsAccountService) {}

  private accessToken(): string {
    return this.adsAccount.requireConfig(
      'PINTEREST_ADS_ACCESS_TOKEN',
      'PINTEREST_ADS_ACCESS_TOKEN is required for Pinterest Ads',
    );
  }

  private adAccountId(): string {
    return this.adsAccount.requireConfig(
      'PINTEREST_AD_ACCOUNT_ID',
      'PINTEREST_AD_ACCOUNT_ID is required for Pinterest Ads',
    );
  }

  async createCampaign(
    tenantId: string,
    payload: AdsPublishPayload,
  ): Promise<string> {
    const { data } = await axios.post<{ id?: string }>(
      `${this.apiBase}/ad_accounts/${this.adAccountId()}/campaigns`,
      {
        name: payload.campaign.name,
        status: 'PAUSED',
        objective_type: 'AWARENESS',
        daily_spend_cap: Math.round(Number(payload.campaign.dailyBudget) * 1_000_000),
      },
      {
        headers: {
          Authorization: `Bearer ${this.accessToken()}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!data?.id) {
      throw new Error('Pinterest Ads API did not return a campaign id');
    }

    this.logger.log(`Created Pinterest campaign ${data.id} for tenant ${tenantId}`);
    return String(data.id);
  }

  async pauseCampaign(
    _tenantId: string,
    platformCampaignId: string,
  ): Promise<void> {
    await axios.patch(
      `${this.apiBase}/ad_accounts/${this.adAccountId()}/campaigns/${platformCampaignId}`,
      { status: 'PAUSED' },
      {
        headers: {
          Authorization: `Bearer ${this.accessToken()}`,
          'Content-Type': 'application/json',
        },
      },
    );
  }

  async getMetrics(
    _tenantId: string,
    platformCampaignId: string,
  ): Promise<AdMetrics> {
    const { data } = await axios.get(
      `${this.apiBase}/ad_accounts/${this.adAccountId()}/campaigns/${platformCampaignId}/analytics`,
      {
        headers: { Authorization: `Bearer ${this.accessToken()}` },
        params: {
          columns: 'SPEND_IN_MICRO_DOLLAR,IMPRESSION,CLICKTHROUGH',
          granularity: 'TOTAL',
        },
      },
    );

    const row = data?.[0] ?? data?.data?.[0] ?? {};
    return {
      spend: Number(row.SPEND_IN_MICRO_DOLLAR ?? 0) / 1_000_000,
      impressions: Number(row.IMPRESSION ?? 0),
      clicks: Number(row.CLICKTHROUGH ?? 0),
    };
  }
}
