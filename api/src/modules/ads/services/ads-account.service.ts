import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { SocialAccounts } from '../../social_accounts/entities/social_accounts.entity';
import { SocialAccountsService } from '../../social_accounts/social_accounts.service';
import { AdPlatform } from '../entities/ad-campaign.entity';
import {
  assertMetaAdsPermissions,
  fetchMetaAdAccountIds,
} from '../utils/meta-graph.util';

import { PlatformIntegrationsService } from '../../system_settings/services/platform-integrations.service';

const PLATFORM_TO_SOCIAL: Partial<Record<AdPlatform, string>> = {
  [AdPlatform.META]: 'facebook',
  [AdPlatform.GOOGLE]: 'google',
  [AdPlatform.TIKTOK]: 'tiktok',
  [AdPlatform.LINKEDIN]: 'linkedin',
  [AdPlatform.X]: 'twitter',
};

@Injectable()
export class AdsAccountService {
  constructor(
    @InjectRepository(SocialAccounts)
    private readonly repo: Repository<SocialAccounts>,
    private readonly socialAccounts: SocialAccountsService,
    private readonly config: ConfigService,
    private readonly platformIntegrations: PlatformIntegrationsService,
  ) {}

  socialPlatform(platform: AdPlatform): string | null {
    return PLATFORM_TO_SOCIAL[platform] ?? null;
  }

  async requireConfig(key: string, hint?: string): Promise<string> {
    const value = (await this.platformIntegrations.getIntegrationWithEnvFallback(key))?.trim();
    if (!value) {
      throw new BadRequestException(
        hint ?? `${key} is not configured on the server`,
      );
    }
    return value;
  }

  async optionalConfig(key: string): Promise<string | undefined> {
    return (await this.platformIntegrations.getIntegrationWithEnvFallback(key))?.trim() || undefined;
  }

  /**
   * The ad platform account a campaign runs through. A campaign created in a
   * workspace only ever uses that workspace's connection, never another
   * workspace's (e.g. another agency client's) account.
   */
  async getConnectedAccount(
    tenantId: string,
    userId: string,
    platform: AdPlatform,
    workspaceId?: string | null,
  ): Promise<SocialAccounts> {
    const socialPlatform = this.socialPlatform(platform);
    if (!socialPlatform) {
      throw new BadRequestException(
        `${platform} ads require server-side API credentials`,
      );
    }

    const scope = workspaceId ? { tenantId, workspaceId } : { tenantId };
    const account =
      (await this.repo.findOne({
        where: { ...scope, userId, platform: socialPlatform, connected: true },
      })) ??
      (await this.repo.findOne({
        where: { ...scope, platform: socialPlatform, connected: true },
      }));

    if (!account?.accessToken) {
      throw new BadRequestException(
        `Connect your ${socialPlatform} account in Publisher Connect before launching ${platform} ads`,
      );
    }

    return this.socialAccounts.refreshAccessTokenIfNeeded(account);
  }

  resolveMetaAccessToken(account: SocialAccounts): string {
    // Ads API requires the user access token (ads_management), not the page token.
    const token = account.accessToken?.trim();
    if (!token) {
      throw new BadRequestException(
        'Facebook user access token is missing — reconnect in Publisher Connect',
      );
    }
    return token;
  }

  resolveMetaPageId(account: SocialAccounts): string | undefined {
    const pageId = account.metadata?.page_id ?? account.externalId;
    return typeof pageId === 'string' && pageId.trim()
      ? pageId.trim()
      : undefined;
  }

  /**
   * The Meta ad account for this connection. META_AD_ACCOUNT_ID is only used when
   * this user's token can actually reach it; otherwise every tenant's campaigns
   * would land in that one account.
   */
  async resolveMetaAdAccountId(accessToken: string): Promise<string> {
    await assertMetaAdsPermissions(accessToken);
    const accessible = await fetchMetaAdAccountIds(accessToken);
    const configured = await this.optionalConfig('META_AD_ACCOUNT_ID');
    if (configured) {
      const id = configured.startsWith('act_') ? configured : `act_${configured}`;
      if (accessible.includes(id)) return id;
    }
    if (!accessible.length) {
      throw new BadRequestException(
        'No Meta ad account is available to this Facebook connection. Create one in Ads Manager or give this user access to the business ad account, then reconnect Facebook.',
      );
    }
    return accessible[0];
  }

}
