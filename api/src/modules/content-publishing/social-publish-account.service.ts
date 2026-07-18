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
import {
  isRecoverableMetaTokenError,
  logOnce,
} from '../../common/throttled-log.util';
import { scopeWhere } from '../../common/workspace-scope.util';

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
    workspaceId?: string,
  ): Promise<SocialAccounts | null> {
    const baseWhere = scopeWhere<SocialAccounts>(tenantId, workspaceId);
    const account =
      (await this.repo.findOne({
        where: { ...baseWhere, userId, platform, connected: true },
      })) ??
      (await this.repo.findOne({
        where: { ...baseWhere, platform, connected: true },
      }));

    if (!account) return null;

    return this.prepareAccount(account);
  }

  /** Refresh OAuth / Meta page tokens on an existing connected account. */
  async prepareAccount(account: SocialAccounts): Promise<SocialAccounts> {
    if (!account.connected) return account;
    if (this.hasRecentAuthFailure(account)) return account;

    let prepared = await this.socialAccounts.refreshAccessTokenIfNeeded(
      account,
    );

    if (
      (prepared.platform === 'linkedin' || prepared.platform === 'twitter') &&
      prepared.refreshToken
    ) {
      prepared = await this.socialAccounts.forceRefreshToken(prepared);
    }

    if (prepared.platform === 'facebook' || prepared.platform === 'instagram') {
      prepared = await this.refreshMetaPageTokens(prepared);
    }

    return prepared;
  }

  private hasRecentAuthFailure(account: SocialAccounts): boolean {
    const at = account.metadata?.auth_error_at;
    if (!at || typeof at !== 'string') return false;
    const age = Date.now() - new Date(at).getTime();
    return age >= 0 && age < 24 * 60 * 60 * 1000;
  }

  async markDisconnectedOnAuthError(
    account: SocialAccounts,
    err: unknown,
  ): Promise<SocialAccounts> {
    const reason = formatPublishError(err, account.platform);
    return this.socialAccounts.markDisconnectedAuth(account, reason);
  }

  /** Re-fetch long-lived page tokens from Meta (required for publish). */
  private async refreshMetaPageTokens(
    account: SocialAccounts,
  ): Promise<SocialAccounts> {
    if (account.metadata?.page_token?.trim()) {
      return account;
    }

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
        logOnce(
          this.logger,
          'debug',
          `meta-no-pages:${account.id}`,
          `No Facebook pages for account ${account.id}`,
        );
        return account;
      }

      const targetPageId =
        account.metadata?.page_id ??
        (account.platform === 'facebook'
          ? account.externalId
          : account.metadata?.page_id);
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
      if (isTokenAuthError(err) || isRecoverableMetaTokenError(err)) {
        logOnce(
          this.logger,
          'debug',
          `meta-page-token:${account.id}`,
          `Meta page token unavailable for ${account.platform} (${
            account.id
          }): ${summarizeAxiosError(err)}`,
        );
        return this.markDisconnectedOnAuthError(account, err);
      }
      logOnce(
        this.logger,
        'debug',
        `meta-page-token-other:${account.id}`,
        `Could not refresh Meta page token for ${
          account.platform
        }: ${summarizeAxiosError(err)}`,
      );
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
