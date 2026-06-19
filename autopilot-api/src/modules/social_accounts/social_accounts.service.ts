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
import { summarizeAxiosError, isTokenAuthError } from '../content-publishing/publish-error.util';
import { isRecoverableMetaTokenError, logOnce } from '../../common/throttled-log.util';
import { scopeWhere } from '../../common/workspace-scope.util';
import {
  SocialAccountsOAuthService,
  WhatsAppPhoneOption,
} from './social_accounts-oauth.service';
import {
  getWhatsappPlatformCredentials,
  isWhatsappPlatformEnabled,
  WhatsappCredentials,
} from '../whatsapp/whatsapp-platform.util';

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
    this.googleOauthClient = new google.auth.OAuth2(googleClientId, googleClientSecret);
  }

  toPublicAccount(account: SocialAccounts) {
    const { accessToken, refreshToken, ...safe } = account;
    return safe;
  }

  async assertTenantAccess(userId: string, tenantId: string) {
    const memberships = await this.tenantMembersService.findForUser(userId);
    const allowed = memberships.some((m) => m.tenantId === tenantId && m.isActive);
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

  async refreshAccessTokenIfNeeded(account: SocialAccounts) {
    if (!account.connected) return account;
    if (this.hasRecentAuthFailure(account)) return account;

    const bufferMs = 5 * 60 * 1000;
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
      account.platform !== 'whatsapp'
    ) {
      return account;
    }

    try {
      const refreshed = await this.refreshProviderToken(account);
      if (!refreshed) {
        return account;
      }

      Object.assign(account, refreshed);
      return this.repo.save(account);
    } catch (error) {
      if (isTokenAuthError(error) || isRecoverableMetaTokenError(error)) {
        return this.markDisconnectedAuth(account, summarizeAxiosError(error));
      }
      logOnce(
        this.logger,
        'debug',
        `token-refresh:${account.id}`,
        `Unable to refresh ${account.platform} token (${account.id}): ${summarizeAxiosError(error)}`,
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

  async markDisconnectedAuth(account: SocialAccounts, reason?: string): Promise<SocialAccounts> {
    this.clearStoredCredentials(account, reason);
    logOnce(
      this.logger,
      'debug',
      `disconnected:${account.id}`,
      `Disconnected ${account.platform} account ${account.id}: ${reason ?? 'auth failure'}`,
    );
    return this.repo.save(account);
  }

  /** Mark account disconnected and wipe tokens (safe for NOT NULL access_token column). */
  private clearStoredCredentials(account: SocialAccounts, reason?: string): void {
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
        return this.refreshInstagramToken(account.accessToken);
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
      default:
        return undefined;
    }
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

    const { data } = await axios.get<{ access_token: string; expires_in?: number }>(
      `https://graph.facebook.com/v18.0/oauth/access_token?${params.toString()}`,
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

    const { data } = await axios.get<{ access_token: string; expires_in?: number }>(
      `https://graph.facebook.com/v18.0/oauth/access_token?${params.toString()}`,
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

  async findByTenant(tenantId: string, userId: string, workspaceId?: string) {
    await this.assertTenantAccess(userId, tenantId);
    const accounts = await this.repo.find({
      where: { ...scopeWhere<SocialAccounts>(tenantId, workspaceId), connected: true },
      order: { created_at: 'DESC' },
    });
    const refreshed = await Promise.all(
      accounts.map(async (account) => this.refreshAccessTokenIfNeeded(account)),
    );
    return refreshed.map((a) => this.toPublicAccount(a));
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

    const hasWhatsAppScopes = await this.oauth.metaTokenHasWhatsAppPermissions(accessToken);
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
      accessToken,
      expiresAt: account.expiresAt?.toISOString(),
      phones,
    });

    return { ready: true, setupToken, phones, source: 'facebook' };
  }

  /** One-click WhatsApp for tenants when the operator configured platform-level Meta credentials. */
  async enablePlatformWhatsapp(tenantId: string, userId: string) {
    await this.assertTenantAccess(userId, tenantId);

    if (!isWhatsappPlatformEnabled(this.config)) {
      throw new BadRequestException(
        'Platform WhatsApp is not configured. Set WHATSAPP_PLATFORM_PHONE_NUMBER_ID and WHATSAPP_PLATFORM_ACCESS_TOKEN on the server.',
      );
    }

    const creds = getWhatsappPlatformCredentials(this.config);
    if (!creds) {
      throw new BadRequestException('Platform WhatsApp credentials are incomplete on the server.');
    }

    const tokenCheck = await this.validateWhatsappCredentials(creds);
    if (!tokenCheck.valid) {
      throw new BadRequestException(tokenCheck.message);
    }

    const displayName =
      this.config.get<string>('WHATSAPP_PLATFORM_DISPLAY_NAME')?.trim() || 'Mako  WhatsApp';
    const displayPhone = this.config.get<string>('WHATSAPP_PLATFORM_DISPLAY_PHONE')?.trim();

    return this.connectAccount({
      tenantId,
      userId,
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
      await axios.get(`https://graph.facebook.com/v19.0/${creds.phoneNumberId}`, {
        params: { fields: 'id', access_token: creds.accessToken },
      });
      return { valid: true };
    } catch (err: unknown) {
      const graphMessage = axios.isAxiosError(err)
        ? (() => {
            const data = err.response?.data as { error?: { message?: string; code?: number } };
            return data?.error?.message
              ? `#${data.error.code ?? '?'} ${data.error.message}`
              : err.message;
          })()
        : err instanceof Error
          ? err.message
          : String(err);

      const expired = /#190\b|session has expired|error validating access token/i.test(
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
