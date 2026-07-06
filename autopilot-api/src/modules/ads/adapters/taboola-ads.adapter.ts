import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { AdMetrics, AdsProviderAdapter } from './ads-provider.adapter';
import { AdPlatform } from '../entities/ad-campaign.entity';
import { AdsAccountService } from '../services/ads-account.service';
import { AdsPublishPayload } from './ads-provider.types';

@Injectable()
export class TaboolaAdsAdapter implements AdsProviderAdapter {
  platform = AdPlatform.TABOOLA;
  private readonly logger = new Logger(TaboolaAdsAdapter.name);

  constructor(private readonly adsAccount: AdsAccountService) {}

  private async getAccessToken(): Promise<string> {
    const clientId = this.adsAccount.requireConfig(
      'TABOOLA_CLIENT_ID',
      'TABOOLA_CLIENT_ID is required for Taboola Ads',
    );
    const clientSecret = this.adsAccount.requireConfig(
      'TABOOLA_CLIENT_SECRET',
      'TABOOLA_CLIENT_SECRET is required for Taboola Ads',
    );

    const { data } = await axios.post<{ access_token?: string }>(
      'https://authentication.taboola.com/authentication/oauth/token',
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    if (!data.access_token) {
      throw new Error('Taboola OAuth did not return an access token');
    }
    return data.access_token;
  }

  private accountId(): string {
    return this.adsAccount.requireConfig(
      'TABOOLA_ACCOUNT_ID',
      'TABOOLA_ACCOUNT_ID is required for Taboola Ads',
    );
  }

  async createCampaign(
    tenantId: string,
    payload: AdsPublishPayload,
  ): Promise<string> {
    const token = await this.getAccessToken();
    const accountId = this.accountId();

    const { data } = await axios.post<{ id?: string }>(
      `https://backstage.taboola.com/backstage/api/1.0/${accountId}/campaigns`,
      {
        name: payload.campaign.name,
        spending_limit: Number(payload.campaign.dailyBudget),
        spending_limit_model: 'MONTHLY',
        cpc: 0.25,
        country_targeting: { type: 'ALL', value: [] },
        platform_targeting: { type: 'ALL', value: [] },
        is_active: false,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!data?.id) {
      throw new Error('Taboola Ads API did not return a campaign id');
    }

    this.logger.log(
      `Created Taboola campaign ${data.id} for tenant ${tenantId}`,
    );
    return String(data.id);
  }

  async pauseCampaign(
    _tenantId: string,
    platformCampaignId: string,
  ): Promise<void> {
    const token = await this.getAccessToken();
    const accountId = this.accountId();

    await axios.post(
      `https://backstage.taboola.com/backstage/api/1.0/${accountId}/campaigns/${platformCampaignId}`,
      { is_active: false },
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
    const token = await this.getAccessToken();
    const accountId = this.accountId();

    const { data } = await axios.get(
      `https://backstage.taboola.com/backstage/api/1.0/${accountId}/reports/campaign-summary/dimensions/campaign_breakdown`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          start_date: '2024-01-01',
          end_date: '2030-12-31',
          campaign: platformCampaignId,
        },
      },
    );

    const row = data?.results?.[0] ?? {};
    return {
      spend: Number(row.spent ?? 0),
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
    };
  }
}
