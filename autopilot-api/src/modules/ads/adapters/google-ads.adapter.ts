import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAdsApi, enums } from 'google-ads-api';
import { AdMetrics, AdsProviderAdapter } from './ads-provider.adapter';
import { AdPlatform } from '../entities/ad-campaign.entity';
import { AdsAccountService } from '../services/ads-account.service';
import { AdsPublishPayload } from './ads-provider.types';

@Injectable()
export class GoogleAdsAdapter implements AdsProviderAdapter {
  platform = AdPlatform.GOOGLE;
  private readonly logger = new Logger(GoogleAdsAdapter.name);

  constructor(
    private readonly config: ConfigService,
    private readonly adsAccount: AdsAccountService,
  ) {}

  private client(): GoogleAdsApi {
    return new GoogleAdsApi({
      client_id: this.adsAccount.requireConfig(
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_ID is required for Google Ads',
      ),
      client_secret: this.adsAccount.requireConfig(
        'GOOGLE_CLIENT_SECRET',
        'GOOGLE_CLIENT_SECRET is required for Google Ads',
      ),
      developer_token: this.adsAccount.requireConfig(
        'GOOGLE_ADS_DEVELOPER_TOKEN',
        'GOOGLE_ADS_DEVELOPER_TOKEN is required for Google Ads',
      ),
    });
  }

  private customer(refreshToken: string) {
    const customerId = this.adsAccount
      .requireConfig(
        'GOOGLE_ADS_CUSTOMER_ID',
        'GOOGLE_ADS_CUSTOMER_ID is required for Google Ads',
      )
      .replace(/-/g, '');

    return this.client().Customer({
      customer_id: customerId,
      refresh_token: refreshToken,
    });
  }

  async createCampaign(
    tenantId: string,
    payload: AdsPublishPayload,
  ): Promise<string> {
    const account = await this.adsAccount.getConnectedAccount(
      tenantId,
      payload.userId,
      AdPlatform.GOOGLE,
    );
    if (!account.refreshToken) {
      throw new Error(
        'Google refresh token missing — reconnect Google in Publisher Connect',
      );
    }

    const customer = this.customer(account.refreshToken);
    const amountMicros = Math.max(
      1_000_000,
      Math.round(Number(payload.campaign.dailyBudget) * 1_000_000),
    );

    const budget = await customer.campaignBudgets.create([
      {
        name: `${payload.campaign.name} Budget`,
        delivery_method: enums.BudgetDeliveryMethod.STANDARD,
        amount_micros: amountMicros,
      },
    ]);

    const budgetResource = budget.results?.[0]?.resource_name;
    if (!budgetResource) {
      throw new Error('Google Ads budget creation returned no resource');
    }

    const created = await customer.campaigns.create([
      {
        name: payload.campaign.name,
        advertising_channel_type: enums.AdvertisingChannelType.SEARCH,
        status: enums.CampaignStatus.PAUSED,
        campaign_budget: budgetResource,
      },
    ]);

    const resourceName = created.results?.[0]?.resource_name;
    if (!resourceName) {
      throw new Error('Google Ads campaign creation returned no resource');
    }

    const id = resourceName.split('/').pop() ?? resourceName;
    this.logger.log(`Created Google Ads campaign ${id} for tenant ${tenantId}`);
    return id;
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
      AdPlatform.GOOGLE,
    );
    if (!account.refreshToken) return;

    const customer = this.customer(account.refreshToken);
    const customerId = this.adsAccount
      .requireConfig('GOOGLE_ADS_CUSTOMER_ID')
      .replace(/-/g, '');
    await customer.campaigns.update([
      {
        resource_name: `customers/${customerId}/campaigns/${platformCampaignId}`,
        status: enums.CampaignStatus.PAUSED,
      },
    ]);
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
      AdPlatform.GOOGLE,
    );
    if (!account.refreshToken) return { spend: 0, impressions: 0, clicks: 0 };

    const customer = this.customer(account.refreshToken);
    const rows = await customer.query(`
      SELECT
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks
      FROM campaign
      WHERE campaign.id = ${platformCampaignId}
    `);

    const row = rows[0]?.metrics;
    return {
      spend: Number(row?.cost_micros ?? 0) / 1_000_000,
      impressions: Number(row?.impressions ?? 0),
      clicks: Number(row?.clicks ?? 0),
    };
  }
}
