import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { AdMetrics, AdsProviderAdapter } from './ads-provider.adapter';
import { AdPlatform } from '../entities/ad-campaign.entity';
import { AdsAccountService } from '../services/ads-account.service';
import { AdsPublishPayload } from './ads-provider.types';

@Injectable()
export class TiktokAdsAdapter implements AdsProviderAdapter {
  platform = AdPlatform.TIKTOK;
  private readonly logger = new Logger(TiktokAdsAdapter.name);
  private readonly apiBase = 'https://business-api.tiktok.com/open_api/v1.3';

  constructor(private readonly adsAccount: AdsAccountService) {}

  private advertiserId(account: {
    metadata?: Record<string, unknown>;
  }): string {
    const fromMeta = account.metadata?.advertiser_id;
    if (typeof fromMeta === 'string' && fromMeta.trim()) return fromMeta.trim();
    return this.adsAccount.requireConfig(
      'TIKTOK_ADVERTISER_ID',
      'TIKTOK_ADVERTISER_ID is required for TikTok Ads',
    );
  }

  async createCampaign(
    tenantId: string,
    payload: AdsPublishPayload,
  ): Promise<string> {
    const account = await this.adsAccount.getConnectedAccount(
      tenantId,
      payload.userId,
      AdPlatform.TIKTOK,
    );
    const advertiserId = this.advertiserId(account);

    const { data } = await axios.post(
      `${this.apiBase}/campaign/create/`,
      {
        advertiser_id: advertiserId,
        campaign_name: payload.campaign.name,
        objective_type: 'TRAFFIC',
        budget_mode: 'BUDGET_MODE_DAY',
        budget: Number(payload.campaign.dailyBudget),
        operation_status: 'DISABLE',
      },
      {
        headers: {
          'Access-Token': account.accessToken!,
          'Content-Type': 'application/json',
        },
      },
    );

    const campaignId = data?.data?.campaign_id;
    if (!campaignId) {
      throw new Error(
        data?.message ?? 'TikTok Ads API did not return a campaign id',
      );
    }

    this.logger.log(
      `Created TikTok campaign ${campaignId} for tenant ${tenantId}`,
    );
    return String(campaignId);
  }

  async pauseCampaign(
    _tenantId: string,
    platformCampaignId: string,
    payload?: AdsPublishPayload,
  ): Promise<void> {
    if (!payload) return;
    const account = await this.adsAccount.getConnectedAccount(
      payload.campaign.tenantId,
      payload.userId,
      AdPlatform.TIKTOK,
    );

    await axios.post(
      `${this.apiBase}/campaign/update/`,
      {
        advertiser_id: this.advertiserId(account),
        campaign_id: platformCampaignId,
        operation_status: 'DISABLE',
      },
      {
        headers: {
          'Access-Token': account.accessToken!,
          'Content-Type': 'application/json',
        },
      },
    );
  }

  async getMetrics(
    _tenantId: string,
    platformCampaignId: string,
    payload?: AdsPublishPayload,
  ): Promise<AdMetrics> {
    if (!payload) return { spend: 0, impressions: 0, clicks: 0 };

    const account = await this.adsAccount.getConnectedAccount(
      payload.campaign.tenantId,
      payload.userId,
      AdPlatform.TIKTOK,
    );

    const { data } = await axios.get(`${this.apiBase}/report/integrated/get/`, {
      headers: { 'Access-Token': account.accessToken! },
      params: {
        advertiser_id: this.advertiserId(account),
        report_type: 'BASIC',
        data_level: 'AUCTION_CAMPAIGN',
        dimensions: JSON.stringify(['campaign_id']),
        metrics: JSON.stringify(['spend', 'impressions', 'clicks']),
        filtering: JSON.stringify([
          {
            field_name: 'campaign_ids',
            filter_type: 'IN',
            filter_value: [platformCampaignId],
          },
        ]),
      },
    });

    const row = data?.data?.list?.[0]?.metrics ?? {};
    return {
      spend: Number(row.spend ?? 0),
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
    };
  }
}
