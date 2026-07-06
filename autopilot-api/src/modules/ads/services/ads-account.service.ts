import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { SocialAccounts } from '../../social_accounts/entities/social_accounts.entity';
import { SocialAccountsService } from '../../social_accounts/social_accounts.service';
import { AdPlatform } from '../entities/ad-campaign.entity';
import {
  assertMetaAdsPermissions,
  fetchMetaAdAccountId,
} from '../utils/meta-graph.util';

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
  ) {}

  socialPlatform(platform: AdPlatform): string | null {
    return PLATFORM_TO_SOCIAL[platform] ?? null;
  }

  requireConfig(key: string, hint?: string): string {
    const value = this.config.get<string>(key)?.trim();
    if (!value) {
      throw new BadRequestException(
        hint ?? `${key} is not configured on the server`,
      );
    }
    return value;
  }

  optionalConfig(key: string): string | undefined {
    return this.config.get<string>(key)?.trim() || undefined;
  }

  async getConnectedAccount(
    tenantId: string,
    userId: string,
    platform: AdPlatform,
  ): Promise<SocialAccounts> {
    const socialPlatform = this.socialPlatform(platform);
    if (!socialPlatform) {
      throw new BadRequestException(
        `${platform} ads require server-side API credentials`,
      );
    }

    const account =
      (await this.repo.findOne({
        where: { tenantId, userId, platform: socialPlatform, connected: true },
      })) ??
      (await this.repo.findOne({
        where: { tenantId, platform: socialPlatform, connected: true },
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
    return typeof pageId === 'string' && pageId.trim() ? pageId.trim() : undefined;
  }

  async resolveMetaAdAccountId(accessToken: string): Promise<string> {
    const configured = this.optionalConfig('META_AD_ACCOUNT_ID');
    if (configured) {
      return configured.startsWith('act_') ? configured : `act_${configured}`;
    }

    await assertMetaAdsPermissions(accessToken);
    return fetchMetaAdAccountId(accessToken);
  }
}
