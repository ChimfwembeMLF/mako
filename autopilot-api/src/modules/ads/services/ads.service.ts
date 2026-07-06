import { Injectable, BadRequestException, ForbiddenException, HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository, In } from 'typeorm';
import {
  AdCampaignEntity,
  AdCampaignStatus,
  AdPlatform,
} from '../entities/ad-campaign.entity';
import { AdCreativeEntity } from '../entities/ad-creative.entity';
import { Tenants } from '../../tenants/entities/tenants.entity';
import { AdsProviderAdapter } from '../adapters/ads-provider.adapter';
import { MetaAdsAdapter } from '../adapters/meta-ads.adapter';
import { GoogleAdsAdapter } from '../adapters/google-ads.adapter';
import { EmbedAdsAdapter } from '../adapters/embed-ads.adapter';
import { TiktokAdsAdapter } from '../adapters/tiktok-ads.adapter';
import { LinkedinAdsAdapter } from '../adapters/linkedin-ads.adapter';
import { PinterestAdsAdapter } from '../adapters/pinterest-ads.adapter';
import { TaboolaAdsAdapter } from '../adapters/taboola-ads.adapter';
import { XAdsAdapter } from '../adapters/x-ads.adapter';
import { MistralChatService } from '../../ai/services/mistral-chat.service';
import { TenantMembersService } from '../../tenant_members/tenant_members.service';
import { resolveApiPublicUrl } from '../../../common/env-urls.util';
import { AdsPublishPayload } from '../adapters/ads-provider.types';

@Injectable()
export class AdsService {
  private adapters: Map<AdPlatform, AdsProviderAdapter> = new Map();

  constructor(
    @InjectRepository(AdCampaignEntity)
    private readonly campaignRepo: Repository<AdCampaignEntity>,
    @InjectRepository(AdCreativeEntity)
    private readonly creativeRepo: Repository<AdCreativeEntity>,
    @InjectRepository(Tenants)
    private readonly tenantsRepo: Repository<Tenants>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly tenantMembers: TenantMembersService,
    private readonly config: ConfigService,
    private readonly metaAdsAdapter: MetaAdsAdapter,
    private readonly googleAdsAdapter: GoogleAdsAdapter,
    private readonly embedAdsAdapter: EmbedAdsAdapter,
    private readonly tiktokAdsAdapter: TiktokAdsAdapter,
    private readonly linkedinAdsAdapter: LinkedinAdsAdapter,
    private readonly pinterestAdsAdapter: PinterestAdsAdapter,
    private readonly taboolaAdsAdapter: TaboolaAdsAdapter,
    private readonly xAdsAdapter: XAdsAdapter,
    private readonly mistral: MistralChatService,
  ) {
    this.adapters.set(AdPlatform.META, metaAdsAdapter);
    this.adapters.set(AdPlatform.GOOGLE, googleAdsAdapter);
    this.adapters.set(AdPlatform.EMBED, embedAdsAdapter);
    this.adapters.set(AdPlatform.TIKTOK, tiktokAdsAdapter);
    this.adapters.set(AdPlatform.LINKEDIN, linkedinAdsAdapter);
    this.adapters.set(AdPlatform.PINTEREST, pinterestAdsAdapter);
    this.adapters.set(AdPlatform.TABOOLA, taboolaAdsAdapter);
    this.adapters.set(AdPlatform.X, xAdsAdapter);
  }

  private async assertTenantAccess(userId: string, tenantId: string) {
    const memberships = await this.tenantMembers.findForUser(userId);
    const allowed = memberships.some(
      (m) => m.tenantId === tenantId && m.isActive,
    );
    if (!allowed) {
      throw new ForbiddenException('You are not a member of this workspace');
    }
  }

  private getAdapter(platform: AdPlatform): AdsProviderAdapter {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new BadRequestException(`Platform ${platform} is not supported yet`);
    }
    return adapter;
  }

  computeCampaignCost(campaign: Pick<AdCampaignEntity, 'dailyBudget' | 'startDate' | 'endDate' | 'platform'>): number {
    if (campaign.platform === AdPlatform.EMBED) return 0;

    let duration = 1;
    if (campaign.startDate && campaign.endDate) {
      const start = new Date(campaign.startDate).getTime();
      const end = new Date(campaign.endDate).getTime();
      duration = Math.max(1, Math.ceil((end - start) / (1000 * 3600 * 24)));
    }
    return Number(campaign.dailyBudget) * duration;
  }

  private async loadCampaignBundle(campaignId: string, tenantId: string) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId, tenantId },
    });
    if (!campaign) throw new BadRequestException('Campaign not found');

    const creative = await this.creativeRepo.findOne({
      where: { campaignId: campaign.id },
    });
    if (!creative) throw new BadRequestException('Campaign creative not found');

    return { campaign, creative };
  }

  async createCampaign(
    userId: string,
    tenantId: string,
    data: {
      name: string;
      platform: AdPlatform;
      dailyBudget: number;
      targetAudience: string;
      prompt: string;
      startDate?: string;
      endDate?: string;
      location?: string;
      ageRange?: string;
      targetUrl?: string;
    },
  ) {
    await this.assertTenantAccess(userId, tenantId);

    const draft = {
      dailyBudget: data.dailyBudget,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      platform: data.platform,
    } as AdCampaignEntity;

    const totalCost = this.computeCampaignCost(draft);
    const tenant = await this.tenantsRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new BadRequestException('Tenant not found');

    const balance = Number(tenant.adsBalance) || 0;
    if (totalCost > 0 && balance < totalCost) {
      throw new BadRequestException(
        `Insufficient ads balance. Required: ${totalCost}, Available: ${balance}`,
      );
    }

    const aiPrompt = `Write a compelling ad for ${data.platform} Ads targeting ${data.targetAudience}. 
    Prompt: ${data.prompt}. 
    Return JSON format: { "headline": "...", "body": "..." }`;

    let headline = 'Boost Your Reach Today!';
    let body = 'This AI generated ad is amazing.';

    try {
      const response = await this.mistral.complete(
        [{ role: 'user', content: aiPrompt }],
        { jsonMode: true },
      );
      const parsed = JSON.parse(response.content);
      if (parsed.headline && parsed.body) {
        headline = parsed.headline;
        body = parsed.body;
      }
    } catch (e) {
      console.warn('Failed to generate AI ad copy, using fallback', e);
    }

    const campaign = this.campaignRepo.create({
      tenantId,
      name: data.name,
      platform: data.platform,
      dailyBudget: data.dailyBudget,
      targetAudience: data.targetAudience,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      location: data.location,
      ageRange: data.ageRange,
      targetUrl: data.targetUrl,
      status: AdCampaignStatus.DRAFT,
    });
    await this.campaignRepo.save(campaign);

    const creative = this.creativeRepo.create({
      campaignId: campaign.id,
      headline,
      body,
    });
    await this.creativeRepo.save(creative);

    return { ...campaign, creative };
  }

  async publishCampaign(userId: string, tenantId: string, campaignId: string) {
    await this.assertTenantAccess(userId, tenantId);

    const { campaign, creative } = await this.loadCampaignBundle(
      campaignId,
      tenantId,
    );

    if (
      campaign.status !== AdCampaignStatus.DRAFT &&
      campaign.status !== AdCampaignStatus.FAILED
    ) {
      throw new BadRequestException(
        `Cannot publish campaign with status ${campaign.status}. Only DRAFT or FAILED campaigns can be published.`,
      );
    }

    const totalCost = this.computeCampaignCost(campaign);
    let charged = false;

    if (totalCost > 0) {
      await this.dataSource.transaction(async (manager) => {
        const tenant = await manager.findOne(Tenants, {
          where: { id: tenantId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!tenant) throw new BadRequestException('Tenant not found');

        const balance = Number(tenant.adsBalance) || 0;
        if (balance < totalCost) {
          throw new BadRequestException(
            `Insufficient ads balance. Required: ${totalCost}, Available: ${balance}`,
          );
        }

        await manager.update(Tenants, tenantId, {
          adsBalance: balance - totalCost,
        });
      });
      charged = true;
    }

    const payload: AdsPublishPayload = { campaign, creative, userId };
    const adapter = this.getAdapter(campaign.platform);

    try {
      const platformId = await adapter.createCampaign(tenantId, payload);
      campaign.platformCampaignId = platformId;
      campaign.status = AdCampaignStatus.ACTIVE;
      creative.isPublished = true;
      await this.creativeRepo.save(creative);
      await this.campaignRepo.save(campaign);
      return { ...campaign, creative };
    } catch (err) {
      campaign.status = AdCampaignStatus.FAILED;
      await this.campaignRepo.save(campaign);

      if (charged) {
        await this.tenantsRepo
          .createQueryBuilder()
          .update(Tenants)
          .set({ adsBalance: () => `ads_balance + ${totalCost}` })
          .where('id = :id', { id: tenantId })
          .execute();
      }

      if (err instanceof HttpException) throw err;

      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Failed to publish campaign: ${message}`);
    }
  }

  async createAndLaunchCampaign(
    userId: string,
    tenantId: string,
    data: Parameters<AdsService['createCampaign']>[2],
  ) {
    const created = await this.createCampaign(userId, tenantId, data);
    return this.publishCampaign(userId, tenantId, created.id);
  }

  async pauseCampaign(userId: string, tenantId: string, campaignId: string) {
    await this.assertTenantAccess(userId, tenantId);

    const { campaign, creative } = await this.loadCampaignBundle(
      campaignId,
      tenantId,
    );

    if (campaign.status !== AdCampaignStatus.ACTIVE) {
      throw new BadRequestException('Only active campaigns can be paused');
    }
    if (!campaign.platformCampaignId) {
      throw new BadRequestException('Campaign has no platform id');
    }

    const adapter = this.getAdapter(campaign.platform);
    const payload: AdsPublishPayload = { campaign, creative, userId };
    await adapter.pauseCampaign(
      tenantId,
      campaign.platformCampaignId,
      payload,
    );

    campaign.status = AdCampaignStatus.PAUSED;
    await this.campaignRepo.save(campaign);
    return campaign;
  }

  async getCampaigns(userId: string, tenantId: string) {
    await this.assertTenantAccess(userId, tenantId);
    const campaigns = await this.campaignRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });

    if (!campaigns.length) return [];

    const creatives = await this.creativeRepo.find({
      where: { campaignId: In(campaigns.map((c) => c.id)) },
    });
    const creativeByCampaign = new Map(
      creatives.map((cr) => [cr.campaignId, cr]),
    );

    return campaigns.map((campaign) => ({
      ...campaign,
      creative: creativeByCampaign.get(campaign.id) ?? null,
    }));
  }

  async getCampaignMetrics(
    userId: string,
    tenantId: string,
    campaignId: string,
  ) {
    await this.assertTenantAccess(userId, tenantId);

    const { campaign, creative } = await this.loadCampaignBundle(
      campaignId,
      tenantId,
    );
    if (!campaign.platformCampaignId) {
      throw new BadRequestException('Campaign not active');
    }

    const adapter = this.getAdapter(campaign.platform);
    const payload: AdsPublishPayload = { campaign, creative, userId };
    return adapter.getMetrics(
      tenantId,
      campaign.platformCampaignId,
      payload,
    );
  }

  async getDashboardStats(userId: string, tenantId: string) {
    await this.assertTenantAccess(userId, tenantId);

    const campaigns = await this.campaignRepo.find({ where: { tenantId } });
    const activeCampaigns = campaigns.filter(
      (c) => c.status === AdCampaignStatus.ACTIVE,
    ).length;

    let totalSpend = 0;
    let totalImpressions = 0;

    for (const campaign of campaigns) {
      if (campaign.platform === AdPlatform.EMBED) {
        totalImpressions += campaign.nativeImpressions || 0;
        continue;
      }

      if (
        campaign.status !== AdCampaignStatus.DRAFT &&
        campaign.status !== AdCampaignStatus.FAILED
      ) {
        totalSpend += this.computeCampaignCost(campaign);
      }

      if (
        campaign.platformCampaignId &&
        campaign.status === AdCampaignStatus.ACTIVE
      ) {
        try {
          const creative = await this.creativeRepo.findOne({
            where: { campaignId: campaign.id },
          });
          if (!creative) continue;
          const adapter = this.getAdapter(campaign.platform);
          const metrics = await adapter.getMetrics(
            tenantId,
            campaign.platformCampaignId,
            { campaign, creative, userId },
          );
          totalImpressions += metrics.impressions;
        } catch {
          // Platform metrics unavailable
        }
      }
    }

    return { activeCampaigns, totalSpend, totalImpressions };
  }

  async getBalance(userId: string, tenantId: string) {
    await this.assertTenantAccess(userId, tenantId);
    const tenant = await this.tenantsRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new BadRequestException('Tenant not found');
    return { balance: Number(tenant.adsBalance) || 0 };
  }

  async getEmbedScript(userId: string, tenantId: string, campaignId: string) {
    await this.assertTenantAccess(userId, tenantId);

    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId, tenantId, platform: AdPlatform.EMBED },
    });
    if (!campaign?.platformCampaignId) {
      throw new BadRequestException('Published embed campaign not found');
    }

    const apiBase = resolveApiPublicUrl(this.config) || 'http://localhost:4000';
    const scriptUrl = `${apiBase}/embed-ads/widget/${campaign.platformCampaignId}.js`;
    return {
      scriptUrl,
      snippet: `<script src="${scriptUrl}" async></script>`,
    };
  }

  async generateCampaignAssist(
    userId: string,
    tenantId: string,
    prompt: string,
    platform?: string,
  ) {
    await this.assertTenantAccess(userId, tenantId);

    const systemPrompt = `You are an expert ad campaign strategist. Based on the user's idea, generate a structured JSON configuration for an ad campaign on ${platform ?? 'digital'} ads.
    Return ONLY valid JSON with no markdown formatting or extra text.
    Format:
    {
      "name": "Campaign Name",
      "targetAudience": "Detailed description of the audience",
      "prompt": "Detailed prompt for generating ad copy and creatives",
      "location": "Suggested location (e.g., specific cities, countries, or 'Global')",
      "ageRange": "Suggested age range (e.g., '18-35')"
    }`;

    const response = await this.mistral.complete(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      { jsonMode: true },
    );

    try {
      let rawJson = response.content.trim();
      if (rawJson.startsWith('```json')) {
        rawJson = rawJson.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (rawJson.startsWith('```')) {
        rawJson = rawJson.replace(/^```/, '').replace(/```$/, '').trim();
      }
      return JSON.parse(rawJson);
    } catch {
      throw new BadRequestException('Failed to generate AI assist data');
    }
  }
}
