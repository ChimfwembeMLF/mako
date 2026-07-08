import { Injectable, Logger } from '@nestjs/common';
import * as bizSdk from 'facebook-nodejs-business-sdk';
import { AdMetrics, AdsProviderAdapter } from './ads-provider.adapter';
import { AdPlatform } from '../entities/ad-campaign.entity';
import { AdsAccountService } from '../services/ads-account.service';
import { AdsPublishPayload } from './ads-provider.types';

function formatMetaError(err: unknown): string {
  const anyErr = err as {
    message?: string;
    response?: {
      message?: string;
      error_user_msg?: string;
      error_user_title?: string;
      error_subcode?: number;
      code?: number;
    };
  };
  const parts = [
    anyErr?.response?.error_user_title,
    anyErr?.response?.error_user_msg,
    anyErr?.response?.message,
    anyErr?.message,
  ].filter(Boolean);
  return parts.join(' — ') || 'Meta Ads API request failed';
}

@Injectable()
export class MetaAdsAdapter implements AdsProviderAdapter {
  platform = AdPlatform.META;
  private readonly logger = new Logger(MetaAdsAdapter.name);

  constructor(private readonly adsAccount: AdsAccountService) {}

  async createCampaign(
    tenantId: string,
    payload: AdsPublishPayload,
  ): Promise<string> {
    const account = await this.adsAccount.getConnectedAccount(
      tenantId,
      payload.userId,
      AdPlatform.META,
    );
    const accessToken = this.adsAccount.resolveMetaAccessToken(account);
    const adAccountId = await this.adsAccount.resolveMetaAdAccountId(
      accessToken,
    );
    const pageId = this.adsAccount.resolveMetaPageId(account);

    bizSdk.FacebookAdsApi.init(accessToken);
    const adAccount = new bizSdk.AdAccount(adAccountId);

    const campaignName = payload.campaign.name.slice(0, 200);

    try {
      const campaign = await adAccount.createCampaign([], {
        name: campaignName,
        objective: 'OUTCOME_TRAFFIC',
        status: 'PAUSED',
        special_ad_categories: ['NONE'],
        is_adset_budget_sharing_enabled: false,
      });

      const dailyBudgetMinor = Math.max(
        100,
        Math.round(Number(payload.campaign.dailyBudget) * 100),
      );

      const adSetParams: Record<string, unknown> = {
        name: `${campaignName} Ad Set`.slice(0, 200),
        campaign_id: campaign.id,
        daily_budget: dailyBudgetMinor,
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LINK_CLICKS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        targeting: {
          geo_locations: { countries: ['ZM'] },
          age_min: 18,
          age_max: 65,
        },
        status: 'PAUSED',
      };

      if (pageId) {
        adSetParams.promoted_object = { page_id: pageId };
      }

      try {
        await adAccount.createAdSet([], adSetParams);
      } catch (adSetErr) {
        this.logger.warn(
          `Meta ad set creation skipped for campaign ${
            campaign.id
          }: ${formatMetaError(adSetErr)}`,
        );
      }

      this.logger.log(
        `Created Meta campaign ${campaign.id} for tenant ${tenantId}`,
      );
      return String(campaign.id);
    } catch (err) {
      throw new Error(formatMetaError(err));
    }
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
      AdPlatform.META,
    );
    const accessToken = this.adsAccount.resolveMetaAccessToken(account);
    bizSdk.FacebookAdsApi.init(accessToken);
    const campaign = new bizSdk.Campaign(platformCampaignId);
    await campaign.update([], { status: 'PAUSED' });
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
      AdPlatform.META,
    );
    const accessToken = this.adsAccount.resolveMetaAccessToken(account);
    bizSdk.FacebookAdsApi.init(accessToken);

    const campaign = new bizSdk.Campaign(platformCampaignId);
    const insights = await campaign.getInsights(
      ['spend', 'impressions', 'clicks'],
      { date_preset: 'maximum' },
    );
    const row = insights?.[0]?._data ?? insights?.[0] ?? {};
    return {
      spend: Number(row.spend ?? 0),
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
    };
  }
}
