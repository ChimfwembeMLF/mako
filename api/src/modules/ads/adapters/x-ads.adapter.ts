import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { AdMetrics, AdsProviderAdapter } from './ads-provider.adapter';
import { AdPlatform } from '../entities/ad-campaign.entity';
import { AdsAccountService } from '../services/ads-account.service';
import { AdsPublishPayload } from './ads-provider.types';

@Injectable()
export class XAdsAdapter implements AdsProviderAdapter {
  platform = AdPlatform.X;
  private readonly logger = new Logger(XAdsAdapter.name);
  private readonly apiBase = 'https://ads-api.twitter.com/12';

  constructor(private readonly adsAccount: AdsAccountService) {}

  private async resolveCredentials(
    tenantId: string,
    userId: string,
  ): Promise<{ accountId: string; accessToken: string }> {
    const accountId = this.adsAccount.optionalConfig('X_ADS_ACCOUNT_ID');
    const envToken = this.adsAccount.optionalConfig('X_ADS_ACCESS_TOKEN');
    if (accountId && envToken) {
      return { accountId, accessToken: envToken };
    }

    const account = await this.adsAccount.getConnectedAccount(
      tenantId,
      userId,
      AdPlatform.X,
    );
    if (!account.accessToken) {
      throw new Error(
        'X Ads credentials missing — connect Twitter or set X_ADS_ACCOUNT_ID and X_ADS_ACCESS_TOKEN',
      );
    }

    return {
      accountId:
        accountId ??
        account.externalId ??
        this.adsAccount.requireConfig('X_ADS_ACCOUNT_ID'),
      accessToken: envToken ?? account.accessToken,
    };
  }

  async createCampaign(
    tenantId: string,
    payload: AdsPublishPayload,
  ): Promise<string> {
    const { accountId, accessToken } = await this.resolveCredentials(
      tenantId,
      payload.userId,
    );

    const { data } = await axios.post<{ data?: { id?: string } }>(
      `${this.apiBase}/accounts/${accountId}/campaigns`,
      {
        name: payload.campaign.name,
        funding_instrument_id: this.adsAccount.optionalConfig(
          'X_ADS_FUNDING_INSTRUMENT_ID',
        ),
        daily_budget_amount_local_micro: Math.round(
          Number(payload.campaign.dailyBudget) * 1_000_000,
        ),
        entity_status: 'PAUSED',
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const campaignId = data?.data?.id;
    if (!campaignId) {
      throw new Error('X Ads API did not return a campaign id');
    }

    this.logger.log(`Created X campaign ${campaignId} for tenant ${tenantId}`);
    return String(campaignId);
  }

  async pauseCampaign(
    tenantId: string,
    platformCampaignId: string,
    payload?: AdsPublishPayload,
  ): Promise<void> {
    if (!payload) return;
    const { accountId, accessToken } = await this.resolveCredentials(
      tenantId,
      payload.userId,
    );

    await axios.put(
      `${this.apiBase}/accounts/${accountId}/campaigns/${platformCampaignId}`,
      { entity_status: 'PAUSED' },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );
  }

  async getMetrics(
    tenantId: string,
    platformCampaignId: string,
    payload?: AdsPublishPayload,
  ): Promise<AdMetrics> {
    if (!payload) return { spend: 0, impressions: 0, clicks: 0 };

    const { accountId, accessToken } = await this.resolveCredentials(
      tenantId,
      payload.userId,
    );

    const { data } = await axios.get(
      `${this.apiBase}/stats/accounts/${accountId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          entity: 'CAMPAIGN',
          entity_ids: platformCampaignId,
          metric_groups: 'ENGAGEMENT,BILLING',
          granularity: 'TOTAL',
        },
      },
    );

    const row = data?.data?.[0] ?? {};
    const metrics = row.id_data?.[0]?.metrics ?? {};
    return {
      spend: Number(metrics.billed_charge_local_micro ?? 0) / 1_000_000,
      impressions: Number(metrics.impressions ?? 0),
      clicks: Number(metrics.clicks ?? 0),
    };
  }
}
