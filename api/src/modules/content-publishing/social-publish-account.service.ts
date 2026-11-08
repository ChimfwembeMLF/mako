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
import { META_GRAPH_VERSION } from '../../common/meta-graph-version';
import { FIRST_COMMENT_PLATFORMS } from '../social_accounts/account-defaults';
import { instagramGraphBase } from './instagram-graph.util';

@Injectable()
export class SocialPublishAccountService {
  private readonly logger = new Logger(SocialPublishAccountService.name);

  constructor(
    @InjectRepository(SocialAccounts)
    private readonly repo: Repository<SocialAccounts>,
    private readonly socialAccounts: SocialAccountsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * The account a post goes out from. A chosen account is used only if it is still
   * connected in this workspace (never swapped silently for another); otherwise the
   * workspace's default for the platform, then the poster's own, then the oldest.
   */
  async getForPublish(
    tenantId: string,
    userId: string,
    platform: string,
    workspaceId?: string,
    accountId?: string,
  ): Promise<SocialAccounts | null> {
    const baseWhere = scopeWhere<SocialAccounts>(tenantId, workspaceId);
    if (accountId) {
      const chosen = await this.repo.findOne({
        where: { ...baseWhere, id: accountId, platform, connected: true },
      });
      return chosen ? this.prepareAccount(chosen) : null;
    }
    const candidates = await this.repo.find({
      where: { ...baseWhere, platform, connected: true },
      order: { created_at: 'ASC' },
    });
    const account = pickDefaultAccount(candidates, userId);
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
      }>(`https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts`, {
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

  /**
   * Adds the account's first comment under a post it just published. Returns false if
   * it couldn't (the post itself is fine either way).
   */
  async postFirstComment(
    account: SocialAccounts,
    platform: string,
    externalPostId: string,
    message: string,
  ): Promise<boolean> {
    if (!FIRST_COMMENT_PLATFORMS.includes(platform) || !message.trim())
      return true;
    const token =
      platform === 'instagram'
        ? this.getInstagramToken(account)
        : this.getFacebookPageToken(account);
    if (!token) return false;
    try {
      const base =
        platform === 'instagram'
          ? instagramGraphBase(account)
          : `https://graph.facebook.com/${META_GRAPH_VERSION}`;
      await axios.post(
        `${base}/${externalPostId}/comments`,
        null,
        {
          params: { message: message.trim(), access_token: token },
          timeout: 15_000,
        },
      );
      return true;
    } catch (err) {
      this.logger.warn(
        `First comment on ${platform} post ${externalPostId} failed: ${summarizeAxiosError(
          err,
        )}`,
      );
      return false;
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

/** The workspace default (metadata.is_default), else the poster's own account, else the oldest. */
export function pickDefaultAccount<
  T extends { userId?: string; metadata?: Record<string, unknown> | null },
>(accounts: T[], userId?: string): T | null {
  return (
    accounts.find((a) => a.metadata?.is_default === true) ??
    accounts.find((a) => userId && a.userId === userId) ??
    accounts[0] ??
    null
  );
}
