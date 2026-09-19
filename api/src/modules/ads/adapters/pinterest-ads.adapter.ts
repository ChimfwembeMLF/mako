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

  private async accessToken(): Promise<string> {
    return await this.adsAccount.requireConfig(
      'PINTEREST_ADS_ACCESS_TOKEN',
      'PINTEREST_ADS_ACCESS_TOKEN is required for Pinterest Ads',
    );
  }

  private async adAccountId(): Promise<string> {
    return await this.adsAccount.requireConfig(
      'PINTEREST_AD_ACCOUNT_ID',
      'PINTEREST_AD_ACCOUNT_ID is required for Pinterest Ads',
    );
  }

  async createCampaign(
    tenantId: string,
    payload: AdsPublishPayload,
  ): Promise<string> {
    const token = await this.accessToken();
    const accountId = await this.adAccountId();
    const { data } = await axios.post<{ id?: string }>(
      `${this.apiBase}/ad_accounts/${accountId}/campaigns`,
      {
        name: payload.campaign.name,
        status: 'PAUSED',
        objective_type: 'AWARENESS',
        daily_spend_cap: Math.round(
          Number(payload.campaign.dailyBudget) * 1_000_000,
        ),
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!data?.id) {
      throw new Error('Pinterest Ads API did not return a campaign id');
    }

    this.logger.log(
      `Created Pinterest campaign ${data.id} for tenant ${tenantId}`,
    );
    return String(data.id);
  }

  async pauseCampaign(
    _tenantId: string,
    platformCampaignId: string,
  ): Promise<void> {
    const token = await this.accessToken();
    const accountId = await this.adAccountId();
    await axios.patch(
      `${this.apiBase}/ad_accounts/${accountId}/campaigns/${platformCampaignId}`,
      { status: 'PAUSED' },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );
  }

  async getMetrics(
    _tenantId: string,
    platformCampaignId: string,
  ): Promise<AdMetrics> {
    const accountId = await this.adAccountId();
    const token = await this.accessToken();
    const { data } = await axios.get(
      `${
        this.apiBase
      }/ad_accounts/${accountId}/campaigns/${platformCampaignId}/analytics`,
      {
        headers: { Authorization: `Bearer ${token}` },
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
