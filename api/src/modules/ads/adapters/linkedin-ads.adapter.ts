import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { AdMetrics, AdsProviderAdapter } from './ads-provider.adapter';
import { AdPlatform } from '../entities/ad-campaign.entity';
import { AdsAccountService } from '../services/ads-account.service';
import { AdsPublishPayload } from './ads-provider.types';

@Injectable()
export class LinkedinAdsAdapter implements AdsProviderAdapter {
  platform = AdPlatform.LINKEDIN;
  private readonly logger = new Logger(LinkedinAdsAdapter.name);

  constructor(private readonly adsAccount: AdsAccountService) {}

  private sponsoredAccountUrn(account: {
    externalId?: string | null;
    metadata?: Record<string, unknown>;
  }): string {
    const fromMeta = account.metadata?.sponsored_account_id;
    const id =
      (typeof fromMeta === 'string' && fromMeta.trim()) ||
      account.externalId?.trim() ||
      this.adsAccount.optionalConfig('LINKEDIN_AD_ACCOUNT_ID');
    if (!id) {
      throw new Error(
        'LinkedIn ad account id missing — reconnect LinkedIn or set LINKEDIN_AD_ACCOUNT_ID',
      );
    }
    return id.startsWith('urn:') ? id : `urn:li:sponsoredAccount:${id}`;
  }

  async createCampaign(
    tenantId: string,
    payload: AdsPublishPayload,
  ): Promise<string> {
    const account = await this.adsAccount.getConnectedAccount(
      tenantId,
      payload.userId,
      AdPlatform.LINKEDIN,
    );

    const { data, headers } = await axios.post<{ id?: string }>(
      'https://api.linkedin.com/rest/adCampaigns',
      {
        account: this.sponsoredAccountUrn(account),
        name: payload.campaign.name,
        status: 'PAUSED',
        type: 'TEXT_AD',
        costType: 'CPC',
        dailyBudget: {
          amount: String(payload.campaign.dailyBudget),
          currencyCode: 'USD',
        },
        unitCost: {
          amount: '2',
          currencyCode: 'USD',
        },
        locale: { country: 'US', language: 'en' },
      },
      {
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': '202402',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      },
    );

    const campaignId =
      data?.id ??
      (headers['x-restli-id'] as string | undefined) ??
      (headers['x-linkedin-id'] as string | undefined);

    if (!campaignId) {
      throw new Error('LinkedIn Ads API did not return a campaign id');
    }

    this.logger.log(
      `Created LinkedIn campaign ${campaignId} for tenant ${tenantId}`,
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
      AdPlatform.LINKEDIN,
    );

    await axios.post(
      `https://api.linkedin.com/rest/adCampaigns/${encodeURIComponent(
        platformCampaignId,
      )}`,
      { patch: { $set: { status: 'PAUSED' } } },
      {
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': '202402',
          'X-Restli-Protocol-Version': '2.0.0',
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
      AdPlatform.LINKEDIN,
    );

    const { data } = await axios.get(
      'https://api.linkedin.com/rest/adAnalytics',
      {
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          'LinkedIn-Version': '202402',
        },
        params: {
          q: 'analytics',
          pivot: 'CAMPAIGN',
          campaigns: `List(${platformCampaignId})`,
          dateRange:
            '(start:(year:2024,month:1,day:1),end:(year:2030,month:12,day:31))',
          fields: 'impressions,clicks,costInLocalCurrency',
        },
      },
    );

    const row = data?.elements?.[0] ?? {};
    return {
      spend: Number(row.costInLocalCurrency ?? 0),
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
    };
  }
}
