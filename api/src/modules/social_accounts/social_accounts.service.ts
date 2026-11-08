import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import axios from 'axios';
import { google, Auth } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { SocialAccounts } from './entities/social_accounts.entity';
import { SocialAccountsCreateDto } from './dto/create-social_accounts.dto';
import { TenantMembersService } from '../tenant_members/tenant_members.service';
import {
  summarizeAxiosError,
  isTokenAuthError,
} from '../content-publishing/publish-error.util';
import {
  isRecoverableMetaTokenError,
  logOnce,
} from '../../common/throttled-log.util';
import { scopeWhere } from '../../common/workspace-scope.util';
import { scopeWhereIncludingTenantWide } from '../../common/workspace-scope.util';
import {
  SocialAccountsOAuthService,
  WhatsAppPhoneOption,
} from './social_accounts-oauth.service';
import {
  getWhatsappPlatformCredentials,
  isWhatsappPlatformEnabled,
  WhatsappCredentials,
} from '../whatsapp/whatsapp-platform.util';
import { META_GRAPH_VERSION } from '../../common/meta-graph-version';

export type WhatsappSetupFromMetaResult =
  | {
      ready: true;
      setupToken: string;
      phones: WhatsAppPhoneOption[];
      source: 'facebook';
    }
  | {
      ready: false;
      needOAuth: true;
      reason: 'no_facebook' | 'missing_scopes' | 'no_phones';
    };

@Injectable()
export class SocialAccountsService {
  private readonly logger = new Logger(SocialAccountsService.name);
  private readonly googleOauthClient: Auth.OAuth2Client;

  constructor(
    @InjectRepository(SocialAccounts)
    private readonly repo: Repository<SocialAccounts>,
    private readonly config: ConfigService,
    private readonly tenantMembersService: TenantMembersService,
    private readonly oauth: SocialAccountsOAuthService,
  ) {
    const googleClientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const googleClientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    this.googleOauthClient = new google.auth.OAuth2(
      googleClientId,
      googleClientSecret,
    );
  }

  /**
   * What the browser may see. Tokens never leave the server, and neither do
   * credentials saved in metadata by manual connect (X API key and secrets,
   * WhatsApp access token): publishing reads those from the database itself.
   */
  toPublicAccount(account: SocialAccounts) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { accessToken, refreshToken, ...safe } = account;
    const metadata = account.metadata
      ? Object.fromEntries(
          Object.entries(account.metadata).filter(
            ([key]) => !/secret|token|password|api_?key|credential/i.test(key),
          ),
        )
      : account.metadata;
    return { ...safe, metadata };
  }

  async assertTenantAccess(userId: string, tenantId: string) {
    const memberships = await this.tenantMembersService.findForUser(userId);
    const allowed = memberships.some(
      (m) => m.tenantId === tenantId && m.isActive,
    );
    if (!allowed) {
      throw new ForbiddenException('You are not a member of this workspace');
    }
  }

  async connectAccount(dto: SocialAccountsCreateDto) {
    if (!dto.userId) {
      throw new UnauthorizedException('UserId is required');
    }
    if (!dto.tenantId) {
      throw new ForbiddenException('tenantId is required');
    }

    await this.assertTenantAccess(dto.userId, dto.tenantId);

    const existing = await this.repo.findOne({
      where: {
        ...scopeWhere<SocialAccounts>(dto.tenantId, dto.workspaceId),
        platform: dto.platform,
        externalId: dto.externalId ? dto.externalId : IsNull(),
      },
    });

    if (existing) {
      Object.assign(existing, dto);
      existing.connected = true;
      const saved = await this.repo.save(existing);
      return this.toPublicAccount(saved);
    }

    const saved = await this.repo.save(
      this.repo.create({
        ...dto,
        connected: true,
      }),
    );
    return this.toPublicAccount(saved);
  }

  async findConnectedByPlatform(
    tenantId: string,
    platform: string,
    workspaceId?: string,
  ): Promise<SocialAccounts | null> {
    return this.repo.findOne({
      where: {
        ...scopeWhere<SocialAccounts>(tenantId, workspaceId),
        platform,
        connected: true,
      },
      order: { updated_at: 'DESC' },
    });
  }

  async refreshAccessTokenIfNeeded(account: SocialAccounts) {
    if (!account.connected) return account;
    if (this.hasRecentAuthFailure(account)) return account;

    const isMeta =
      account.platform === 'facebook' ||
      account.platform === 'instagram' ||
      account.platform === 'whatsapp' ||
      account.platform === 'threads';
    const bufferMs = isMeta ? 15 * 24 * 60 * 60 * 1000 : 5 * 60 * 1000;

    const expiresSoon =
      account.expiresAt && account.expiresAt.getTime() - Date.now() <= bufferMs;

    if (account.expiresAt && !expiresSoon) {
      return account;
    }

    // Meta page tokens are enough for comment sync / publish — avoid refreshing user token every cron tick
    if (
      (account.platform === 'facebook' || account.platform === 'instagram') &&
      account.metadata?.page_token?.trim()
    ) {
      return account;
    }

    if (!account.expiresAt) {
      return account;
    }

    return this.forceRefreshToken(account);
  }

  /** Refresh even when expiry is unknown or still in the future (e.g. before publish). */
  async forceRefreshToken(account: SocialAccounts): Promise<SocialAccounts> {
    if (!account.connected) return account;
    if (this.hasRecentAuthFailure(account)) return account;

    if (
      !account.refreshToken &&
      account.platform !== 'facebook' &&
      account.platform !== 'instagram' &&
      account.platform !== 'whatsapp' &&
      // Threads renews its long-lived token without a refresh token.
      account.platform !== 'threads'
    ) {
      return account;
    }

    try {
      const refreshed = await this.refreshProviderToken(account);
      if (!refreshed) {
        return account;
      }

      // Keep the saved refresh token when a provider doesn't send a new one.
      Object.assign(
        account,
        Object.fromEntries(Object.entries(refreshed).filter(([, v]) => v !== undefined)),
      );
      return this.repo.save(account);
    } catch (error) {
      if (isTokenAuthError(error) || isRecoverableMetaTokenError(error)) {
        return this.markDisconnectedAuth(account, summarizeAxiosError(error));
      }
      logOnce(
        this.logger,
        'debug',
        `token-refresh:${account.id}`,
        `Unable to refresh ${account.platform} token (${
          account.id
        }): ${summarizeAxiosError(error)}`,
      );
      return account;
    }
  }

  private hasRecentAuthFailure(account: SocialAccounts): boolean {
    const at = account.metadata?.auth_error_at;
    if (!at || typeof at !== 'string') return false;
    const age = Date.now() - new Date(at).getTime();
    return age >= 0 && age < 24 * 60 * 60 * 1000;
  }

  async markDisconnectedAuth(
    account: SocialAccounts,
    reason?: string,
  ): Promise<SocialAccounts> {
    this.clearStoredCredentials(account, reason);
    logOnce(
      this.logger,
      'debug',
      `disconnected:${account.id}`,
      `Disconnected ${account.platform} account ${account.id}: ${
        reason ?? 'auth failure'
      }`,
    );
    return this.repo.save(account);
  }

  /** Mark account disconnected and wipe tokens (safe for NOT NULL access_token column). */
  private clearStoredCredentials(
    account: SocialAccounts,
    reason?: string,
  ): void {
    account.connected = false;
    account.accessToken = '';
    account.refreshToken = undefined;
    account.expiresAt = undefined;
    const meta = { ...(account.metadata ?? {}) };
    delete meta.page_token;
    delete meta.page_id;
    delete meta.page_name;
    if (reason) {
      meta.auth_error = reason;
      meta.auth_error_at = new Date().toISOString();
    }
    account.metadata = meta;
  }

  private async refreshProviderToken(account: SocialAccounts) {
    switch (account.platform) {
      case 'facebook':
        return this.refreshFacebookToken(account.accessToken);
      case 'instagram':
        return account.metadata?.login_type === 'instagram'
          ? this.refreshLongLivedToken(
              'https://graph.instagram.com/refresh_access_token',
              'ig_refresh_token',
              account.accessToken,
            )
          : this.refreshInstagramToken(account.accessToken);
      case 'threads':
        return this.refreshLongLivedToken(
          'https://graph.threads.net/refresh_access_token',
          'th_refresh_token',
          account.accessToken,
        );
      case 'pinterest':
        return account.refreshToken
          ? this.refreshPinterestToken(account.refreshToken)
          : undefined;
      case 'google_business':
        return account.refreshToken
          ? this.refreshGoogleToken(account.refreshToken)
          : undefined;
      case 'whatsapp':
        return account.accessToken?.trim()
          ? this.refreshFacebookToken(account.accessToken)
          : undefined;
      case 'linkedin':
        return account.refreshToken
          ? this.refreshLinkedInToken(account.refreshToken)
          : undefined;
      case 'google':
      case 'youtube':
        return account.refreshToken
          ? this.refreshGoogleToken(account.refreshToken)
          : undefined;
      case 'tiktok':
        return account.refreshToken
          ? this.refreshTikTokToken(account.refreshToken)
          : undefined;
      case 'twitter':
      case 'x':
        return account.refreshToken
          ? this.refreshTwitterToken(account.refreshToken)
          : undefined;
      default:
        return undefined;
    }
  }

  /** Instagram Login and Threads renew a long-lived token by exchanging the current one. */
  private async refreshLongLivedToken(url: string, grantType: string, accessToken: string) {
    const { data } = await axios.get<{ access_token: string; expires_in?: number }>(url, {
      params: { grant_type: grantType, access_token: accessToken },
      timeout: 20_000,
    });
    if (!data.access_token) throw new Error('Token refresh failed');
    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    };
  }

  private async refreshPinterestToken(refreshToken: string) {
    const id = this.config.get<string>('PINTEREST_APP_ID');
    const secret = this.config.get<string>('PINTEREST_APP_SECRET');
    if (!id || !secret) throw new Error('Pinterest credentials are not configured');
    const { data } = await axios.post<{ access_token: string; refresh_token?: string; expires_in?: number }>(
      'https://api.pinterest.com/v5/oauth/token',
      new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
      {
        auth: { username: id, password: secret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 20_000,
      },
    );
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    };
  }

  private async refreshFacebookToken(accessToken: string) {
    const appId = this.config.get<string>('FACEBOOK_APP_ID');
    const appSecret = this.config.get<string>('FACEBOOK_APP_SECRET');
    if (!appId || !appSecret) {
      throw new Error('Facebook app credentials are not configured');
    }

    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: accessToken,
    });

    const { data } = await axios.get<{
      access_token: string;
      expires_in?: number;
    }>(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${params.toString()}`,
    );

    if (!data.access_token) {
      throw new Error('Facebook token refresh failed');
    }

    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    };
  }

  private async refreshInstagramToken(accessToken: string) {
    const clientId =
      this.config.get<string>('INSTAGRAM_CLIENT_ID') ||
      this.config.get<string>('FACEBOOK_APP_ID');
    const clientSecret =
      this.config.get<string>('INSTAGRAM_CLIENT_SECRET') ||
      this.config.get<string>('FACEBOOK_APP_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('Instagram credentials are not configured');
    }

    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: clientId,
      client_secret: clientSecret,
      fb_exchange_token: accessToken,
    });

    const { data } = await axios.get<{
      access_token: string;
      expires_in?: number;
    }>(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${params.toString()}`,
    );

    if (!data.access_token) {
      throw new Error('Instagram token refresh failed');
    }

    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    };
  }

  private async refreshLinkedInToken(refreshToken: string) {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.getOrThrow<string>('LINKEDIN_CLIENT_ID'),
      client_secret: this.config.getOrThrow<string>('LINKEDIN_CLIENT_SECRET'),
    });

    const { data } = await axios.post<{
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    }>('https://www.linkedin.com/oauth/v2/accessToken', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!data.access_token) {
      throw new Error('LinkedIn refresh failed');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    };
  }

  private async refreshGoogleToken(refreshToken: string) {
    this.googleOauthClient.setCredentials({ refresh_token: refreshToken });
    const refreshedResponse = await this.googleOauthClient.refreshAccessToken();
    const refreshed = refreshedResponse.credentials;

    if (!refreshed.access_token) {
      throw new Error('Google refresh failed');
    }

    return {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? refreshToken,
      expiresAt: refreshed.expiry_date
        ? new Date(refreshed.expiry_date)
        : undefined,
    };
  }

  private async refreshTikTokToken(refreshToken: string) {
    const refreshed = await this.oauth.refreshTikTokAccessToken(refreshToken);
    return {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? refreshToken,
      expiresAt: refreshed.expiresAt,
    };
  }

  private async refreshTwitterToken(refreshToken: string) {
    const refreshed = await this.oauth.refreshTwitterAccessToken(refreshToken);
    return {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? refreshToken,
      expiresAt: refreshed.expiresAt,
    };
  }

  async findByTenant(tenantId: string, userId: string, workspaceId?: string) {
    await this.assertTenantAccess(userId, tenantId);
    const accounts = await this.repo.find({
      where: scopeWhereIncludingTenantWide<SocialAccounts>(
        tenantId,
        workspaceId,
        {
          connected: true,
        },
      ),
      order: { created_at: 'DESC' },
    });
    const refreshed = await Promise.all(
      accounts.map(async (account) => this.refreshAccessTokenIfNeeded(account)),
    );
    return refreshed.map((a) => this.toPublicAccount(a));
  }

  /**
   * Everything the Social accounts page shows: connected accounts plus ones that lost
   * access recently (so they can be reconnected rather than silently vanishing), each
   * with who connected it and its recent publishing activity.
   */
  async findForManagement(
    tenantId: string,
    userId: string,
    workspaceId?: string,
  ) {
    await this.assertTenantAccess(userId, tenantId);
    const all = await this.repo.find({
      where: scopeWhereIncludingTenantWide<SocialAccounts>(
        tenantId,
        workspaceId,
        {},
      ),
      order: { created_at: 'ASC' },
    });
    const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
    const connectedKeys = new Set(
      all
        .filter((a) => a.connected)
        .map((a) => `${a.platform}:${a.externalId ?? a.id}`),
    );
    const rows = all.filter((a) => {
      if (a.connected) return true;
      const at = a.metadata?.auth_error_at;
      return (
        typeof at === 'string' &&
        new Date(at).getTime() > cutoff &&
        !connectedKeys.has(`${a.platform}:${a.externalId ?? a.id}`)
      );
    });
    if (!rows.length) return [];

    const ids = rows.map((a) => a.id);
    const manager = this.repo.manager;
    const activity: Array<{
      social_account_id: string;
      status: string;
      last_at: Date;
      last_error: string | null;
    }> = await manager.query(
      `SELECT DISTINCT ON (social_account_id, status)
                social_account_id, status, COALESCE(published_at, created_at) AS last_at, error_message AS last_error
           FROM content_publications
          WHERE social_account_id = ANY($1)
          ORDER BY social_account_id, status, COALESCE(published_at, created_at) DESC`,
      [ids],
    );
    const userIds = [...new Set(rows.map((a) => a.userId).filter(Boolean))];
    const people: Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      member: boolean;
    }> = userIds.length
      ? await manager.query(
          `SELECT u.id, u.first_name, u.last_name, u.email,
                    EXISTS (SELECT 1 FROM tenant_members m WHERE m.user_id = u.id AND m.tenant_id = $2 AND m.is_active) AS member
               FROM users u WHERE u.id = ANY($1)`,
          [userIds, tenantId],
        )
      : [];

    const refreshed = await Promise.all(
      rows.map((account) =>
        account.connected ? this.refreshAccessTokenIfNeeded(account) : account,
      ),
    );
    return refreshed.map((account) => {
      const mine = activity.filter((r) => r.social_account_id === account.id);
      const published = mine.find((r) => r.status === 'published');
      const failed = mine.find((r) => r.status === 'failed');
      const person = people.find((p) => p.id === account.userId);
      return {
        ...this.toPublicAccount(account),
        activity: {
          lastPublishedAt: published?.last_at ?? null,
          lastFailedAt: failed?.last_at ?? null,
          lastError: failed?.last_error ?? null,
        },
        connectedBy: person
          ? {
              name:
                [person.first_name, person.last_name]
                  .filter(Boolean)
                  .join(' ') || person.email,
              email: person.email,
              stillMember: Boolean(person.member),
            }
          : null,
      };
    });
  }

  /** Makes this the account posts go out from by default for its platform in its workspace. */
  async setDefault(id: string, tenantId: string, userId: string) {
    const acc = await this.findOneForTenant(id, tenantId, userId);
    if (!acc.connected)
      throw new ForbiddenException(
        'Reconnect this account before making it the default',
      );
    const siblings = await this.repo.find({
      where: {
        ...scopeWhere<SocialAccounts>(tenantId, acc.workspaceId ?? undefined),
        platform: acc.platform,
      },
    });
    for (const s of siblings) {
      const isDefault = s.id === acc.id;
      if (Boolean(s.metadata?.is_default) === isDefault) continue;
      s.metadata = { ...(s.metadata ?? {}), is_default: isDefault };
      await this.repo.save(s);
    }
    return this.toPublicAccount({
      ...acc,
      metadata: { ...(acc.metadata ?? {}), is_default: true },
    });
  }

  /** Saves default hashtags and first comment for posts from this account. */
  async setDefaults(
    id: string,
    tenantId: string,
    userId: string,
    defaults: { hashtags?: string | null; firstComment?: string | null },
  ) {
    const acc = await this.findOneForTenant(id, tenantId, userId);
    const clean = (v: string | null | undefined, max: number) =>
      typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;
    acc.metadata = {
      ...(acc.metadata ?? {}),
      defaults: {
        hashtags: clean(defaults.hashtags, 500),
        firstComment: clean(defaults.firstComment, 2000),
      },
    };
    return this.toPublicAccount(await this.repo.save(acc));
  }

  async findByUser(userId: string) {
    const accounts = await this.repo.find({ where: { userId } });
    const refreshed = await Promise.all(
      accounts.map(async (account) => this.refreshAccessTokenIfNeeded(account)),
    );
    return refreshed.map((a) => this.toPublicAccount(a));
  }

  async findOne(id: string) {
    const acc = await this.repo.findOne({ where: { id } });
    if (!acc) throw new NotFoundException('Not found');
    return acc;
  }

  async findOneForUser(id: string, userId: string) {
    const acc = await this.repo.findOne({ where: { id, userId } });
    if (!acc) throw new NotFoundException('Not found');
    return acc;
  }

  async findOneForTenant(id: string, tenantId: string, userId: string) {
    await this.assertTenantAccess(userId, tenantId);
    const acc = await this.repo.findOne({ where: { id, tenantId } });
    if (!acc) throw new NotFoundException('Not found');
    return acc;
  }

  async disconnect(id: string, userId: string, tenantId?: string) {
    const acc = tenantId
      ? await this.findOneForTenant(id, tenantId, userId)
      : await this.findOneForUser(id, userId);
    this.clearStoredCredentials(acc);
    const saved = await this.repo.save(acc);
    return this.toPublicAccount(saved);
  }

  async remove(id: string, userId: string, tenantId?: string) {
    if (tenantId) {
      await this.findOneForTenant(id, tenantId, userId);
    } else {
      await this.findOneForUser(id, userId);
    }
    const res = await this.repo.delete(id);
    if (!res.affected) throw new NotFoundException();
  }

  /**
   * Reuse a connected Facebook account when its token already has WhatsApp permissions.
   * Returns needOAuth when Facebook is missing, lacks scopes, or has no listable numbers.
   */
  async prepareWhatsappFromExistingMeta(
    tenantId: string,
    userId: string,
    workspaceId?: string,
  ): Promise<WhatsappSetupFromMetaResult> {
    await this.assertTenantAccess(userId, tenantId);

    const facebook = await this.repo.findOne({
      where: { tenantId, platform: 'facebook', connected: true },
      order: { updated_at: 'DESC' },
    });

    if (!facebook?.accessToken?.trim()) {
      return { ready: false, needOAuth: true, reason: 'no_facebook' };
    }

    const account = await this.refreshAccessTokenIfNeeded(facebook);
    const accessToken = account.accessToken?.trim();
    if (!accessToken) {
      return { ready: false, needOAuth: true, reason: 'no_facebook' };
    }

    const hasWhatsAppScopes = await this.oauth.metaTokenHasWhatsAppPermissions(
      accessToken,
    );
    if (!hasWhatsAppScopes) {
      return { ready: false, needOAuth: true, reason: 'missing_scopes' };
    }

    const phones = await this.oauth.discoverWhatsAppPhones(accessToken);
    if (!phones.length) {
      return { ready: false, needOAuth: true, reason: 'no_phones' };
    }

    const setupToken = this.oauth.createWhatsAppSetupToken({
      userId,
      tenantId,
      workspaceId,
      accessToken,
      expiresAt: account.expiresAt?.toISOString(),
      phones,
    });

    return { ready: true, setupToken, phones, source: 'facebook' };
  }

  /** One-click WhatsApp for tenants when the operator configured platform-level Meta credentials. */
  async enablePlatformWhatsapp(
    tenantId: string,
    userId: string,
    workspaceId?: string,
  ) {
    await this.assertTenantAccess(userId, tenantId);

    if (!isWhatsappPlatformEnabled(this.config)) {
      throw new BadRequestException(
        'Platform WhatsApp is not configured. Set WHATSAPP_PLATFORM_PHONE_NUMBER_ID and WHATSAPP_PLATFORM_ACCESS_TOKEN on the server.',
      );
    }

    const creds = getWhatsappPlatformCredentials(this.config);
    if (!creds) {
      throw new BadRequestException(
        'Platform WhatsApp credentials are incomplete on the server.',
      );
    }

    const tokenCheck = await this.validateWhatsappCredentials(creds);
    if (!tokenCheck.valid) {
      throw new BadRequestException(tokenCheck.message);
    }

    const displayName =
      this.config.get<string>('WHATSAPP_PLATFORM_DISPLAY_NAME')?.trim() ||
      'Mako  WhatsApp';
    const displayPhone = this.config
      .get<string>('WHATSAPP_PLATFORM_DISPLAY_PHONE')
      ?.trim();

    return this.connectAccount({
      tenantId,
      userId,
      workspaceId,
      platform: 'whatsapp',
      accountName: displayName,
      externalId: creds.phoneNumberId,
      username: displayPhone,
      accessToken: '',
      metadata: {
        platform_managed: true,
        phone_number_id: creds.phoneNumberId,
        display_phone_number: displayPhone,
        waba_id: this.config.get<string>('WHATSAPP_PLATFORM_WABA_ID')?.trim(),
      },
      connected: true,
    });
  }

  private async validateWhatsappCredentials(
    creds: WhatsappCredentials,
  ): Promise<{ valid: boolean; message?: string }> {
    try {
      await axios.get(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/${creds.phoneNumberId}`,
        {
          params: { fields: 'id', access_token: creds.accessToken },
        },
      );
      return { valid: true };
    } catch (err: unknown) {
      const graphMessage = axios.isAxiosError(err)
        ? (() => {
            const data = err.response?.data as {
              error?: { message?: string; code?: number };
            };
            return data?.error?.message
              ? `#${data.error.code ?? '?'} ${data.error.message}`
              : err.message;
          })()
        : err instanceof Error
        ? err.message
        : String(err);

      const expired =
        /#190\b|session has expired|error validating access token/i.test(
          graphMessage,
        );
      return {
        valid: false,
        message: expired
          ? 'Platform WhatsApp access token expired. Update WHATSAPP_PLATFORM_ACCESS_TOKEN in the server environment with a new System User token from Meta Business Settings, then restart the API.'
          : `Platform WhatsApp credentials are invalid: ${graphMessage}`,
      };
    }
  }
}
