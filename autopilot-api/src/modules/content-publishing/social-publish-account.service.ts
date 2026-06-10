import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { SocialAccountsService } from '../social_accounts/social_accounts.service';
import {
  formatPublishError,
  isTokenAuthError,
  summarizeAxiosError,
} from './publish-error.util';

@Injectable()
export class SocialPublishAccountService {
  private readonly logger = new Logger(SocialPublishAccountService.name);

  constructor(
    @InjectRepository(SocialAccounts)
    private readonly repo: Repository<SocialAccounts>,
    private readonly socialAccounts: SocialAccountsService,
    private readonly config: ConfigService,
  ) {}

  async getForPublish(
    tenantId: string,
    userId: string,
    platform: string,
  ): Promise<SocialAccounts | null> {
    let account =
      (await this.repo.findOne({
        where: { tenantId, userId, platform, connected: true },
      })) ??
      (await this.repo.findOne({
        where: { tenantId, platform, connected: true },
      }));

    if (!account) return null;

    account = await this.socialAccounts.refreshAccessTokenIfNeeded(account);

    if (platform === 'linkedin' && account.refreshToken) {
      account = await this.socialAccounts.forceRefreshToken(account);
    }

    if (platform === 'facebook' || platform === 'instagram') {
      account = await this.refreshMetaPageTokens(account);
    }

    return account;
  }

  async markDisconnectedOnAuthError(
    account: SocialAccounts,
    err: unknown,
  ): Promise<SocialAccounts> {
    const reason = formatPublishError(err, account.platform);
    return this.socialAccounts.markDisconnectedAuth(account, reason);
  }

  /** Re-fetch long-lived page tokens from Meta (required for publish). */
  private async refreshMetaPageTokens(account: SocialAccounts): Promise<SocialAccounts> {
    const userToken = account.accessToken;
    if (!userToken) return account;

    try {
      const { data } = await axios.get<{
        data?: Array<{ id: string; name?: string; access_token?: string }>;
      }>('https://graph.facebook.com/v19.0/me/accounts', {
        params: { access_token: userToken, fields: 'id,name,access_token' },
      });

      const pages = data.data ?? [];
      if (!pages.length) {
        this.logger.warn(`No Facebook pages for account ${account.id}`);
        return account;
      }

      const targetPageId =
        account.metadata?.page_id ??
        (account.platform === 'facebook' ? account.externalId : account.metadata?.page_id);
      const page = pages.find((p) => p.id === targetPageId) ?? pages[0];
      if (!page?.access_token) return account;

      account.metadata = {
        ...account.metadata,
        page_id: page.id,
        page_name: page.name,
        page_token: page.access_token,
      };

      if (account.platform === 'instagram') {
        account.accessToken = page.access_token;
      }

      return this.repo.save(account);
    } catch (err) {
      this.logger.warn(
        `Could not refresh Meta page token for ${account.platform}: ${summarizeAxiosError(err)}`,
      );
      if (isTokenAuthError(err)) {
        return this.markDisconnectedOnAuthError(account, err);
      }
      return account;
    }
  }

  getFacebookPageToken(account: SocialAccounts): string | null {
    return account.metadata?.page_token ?? account.accessToken ?? null;
  }

  getInstagramToken(account: SocialAccounts): string | null {
    return account.metadata?.page_token ?? account.accessToken ?? null;
  }

  getLinkedInPersonId(account: SocialAccounts): string | null {
    return account.metadata?.person_id ?? account.externalId ?? null;
  }
}
