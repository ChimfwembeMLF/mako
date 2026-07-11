import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { SocialInsights } from './entities/social_insights.entity';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { scopeWhere } from '../../common/workspace-scope.util';

const GRAPH_API = 'https://graph.facebook.com/v20.0';

@Injectable()
export class PageInsightsService {
  private readonly logger = new Logger(PageInsightsService.name);

  constructor(
    @InjectRepository(SocialInsights)
    private readonly insightsRepo: Repository<SocialInsights>,
    @InjectRepository(SocialAccounts)
    private readonly accountsRepo: Repository<SocialAccounts>,
  ) {}

  async syncAllInsights(): Promise<void> {
    const accounts = await this.accountsRepo.find({
      where: { connected: true },
    });

    for (const account of accounts) {
      if (account.platform === 'facebook' || account.platform === 'instagram') {
        try {
          await this.syncAccountInsights(account);
        } catch (err) {
          this.logger.error(`Failed to sync insights for ${account.id}`, err);
        }
      }
    }
  }

  async syncAccountInsights(account: SocialAccounts): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.insightsRepo.findOne({
      where: { socialAccountId: account.id, date: today },
    });

    let insights: Partial<SocialInsights> = {};

    if (account.platform === 'facebook') {
      insights = await this.fetchFacebookInsights(account);
    } else if (account.platform === 'instagram') {
      insights = await this.fetchInstagramInsights(account);
    }

    if (existing) {
      await this.insightsRepo.update(existing.id, insights);
    } else {
      await this.insightsRepo.save(
        this.insightsRepo.create({
          tenantId: account.tenantId,
          workspaceId: account.workspaceId,
          socialAccountId: account.id,
          date: today,
          ...insights,
        }),
      );
    }
  }

  private async fetchFacebookInsights(
    account: SocialAccounts,
  ): Promise<Partial<SocialInsights>> {
    const token = account.metadata?.page_token ?? account.accessToken;
    const pageId = account.metadata?.page_id ?? account.externalId;
    if (!token || !pageId) return {};

    try {
      // Fetch follower count
      const pageRes = await axios.get(`${GRAPH_API}/${pageId}`, {
        params: {
          access_token: token,
          fields: 'followers_count',
        },
      });

      // Fetch reach and impressions (last 28 days or day)
      const metricsRes = await axios.get(`${GRAPH_API}/${pageId}/insights`, {
        params: {
          access_token: token,
          metric: 'page_impressions_unique,page_impressions', // Reach and Impressions
          period: 'day',
        },
      });

      const followersCount = pageRes.data?.followers_count ?? 0;
      let reach = 0;
      let impressions = 0;

      const data = metricsRes.data?.data ?? [];
      for (const item of data) {
        if (item.name === 'page_impressions_unique') {
          reach = item.values?.[0]?.value ?? 0;
        }
        if (item.name === 'page_impressions') {
          impressions = item.values?.[0]?.value ?? 0;
        }
      }

      return { followersCount, reach, impressions };
    } catch (err) {
      this.logger.warn(`FB Insights fetch failed: ${err}`);
      return {};
    }
  }

  private async fetchInstagramInsights(
    account: SocialAccounts,
  ): Promise<Partial<SocialInsights>> {
    const token = account.accessToken; // Or metadata IG token
    const igId = account.metadata?.instagram_business_account_id ?? account.externalId;
    if (!token || !igId) return {};

    try {
      const pageRes = await axios.get(`${GRAPH_API}/${igId}`, {
        params: {
          access_token: token,
          fields: 'followers_count',
        },
      });

      const metricsRes = await axios.get(`${GRAPH_API}/${igId}/insights`, {
        params: {
          access_token: token,
          metric: 'reach,impressions',
          period: 'day',
        },
      });

      const followersCount = pageRes.data?.followers_count ?? 0;
      let reach = 0;
      let impressions = 0;

      const data = metricsRes.data?.data ?? [];
      for (const item of data) {
        if (item.name === 'reach') {
          reach = item.values?.[0]?.value ?? 0;
        }
        if (item.name === 'impressions') {
          impressions = item.values?.[0]?.value ?? 0;
        }
      }

      return { followersCount, reach, impressions };
    } catch (err) {
      this.logger.warn(`IG Insights fetch failed: ${err}`);
      return {};
    }
  }
}
