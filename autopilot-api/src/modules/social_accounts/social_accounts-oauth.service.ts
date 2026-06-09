import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { google } from 'googleapis';
import {
  FACEBOOK_PUBLISHER_SCOPES,
  GOOGLE_PUBLISHER_SCOPES,
  INSTAGRAM_PUBLISHER_SCOPES,
  LINKEDIN_PUBLISHER_SCOPES,
  scopesToParam,
} from './social_accounts-oauth.scopes';

export type SocialOAuthPlatform = 'facebook' | 'linkedin' | 'instagram' | 'google';

export interface OAuthConnectState {
  userId: string;
  tenantId: string;
  returnUrl?: string;
  provider: SocialOAuthPlatform;
  redirectUri: string;
}

export interface OAuthConnectResult {
  platform: SocialOAuthPlatform;
  accountName: string;
  externalId?: string;
  username?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class SocialAccountsOAuthService {
  private readonly logger = new Logger(SocialAccountsOAuthService.name);

  constructor(private readonly config: ConfigService) {}

  encodeState(state: OAuthConnectState): string {
    // base64url — avoid padding chars that get double-encoded in redirect URLs
    return Buffer.from(JSON.stringify(state)).toString('base64url');
  }

  decodeState(state: string): OAuthConnectState | null {
    try {
      let raw = state.trim();
      for (let i = 0; i < 3 && raw.includes('%'); i++) {
        raw = decodeURIComponent(raw);
      }
      const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
      const pad = b64.length % 4;
      const padded = pad ? b64 + '='.repeat(4 - pad) : b64;
      return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as OAuthConnectState;
    } catch (err) {
      this.logger.warn('Failed to decode OAuth state', err);
      return null;
    }
  }

  getCallbackUrl(apiBaseUrl: string, platform: SocialOAuthPlatform): string {
    const envKey = `${platform.toUpperCase()}_SOCIAL_CALLBACK_URL`;
    const fromEnv = this.config.get<string>(envKey);
    if (fromEnv?.trim()) {
      return fromEnv.trim().replace(/\/$/, '');
    }

    const base = (
      this.config.get<string>('API_BASE_URL') ||
      apiBaseUrl
    ).replace(/\/$/, '');

    return `${base}/api/v1/social-accounts/oauth/${platform}/callback`;
  }

  getAuthorizeUrl(
    platform: SocialOAuthPlatform,
    state: string,
    redirectUri: string,
  ): string {
    switch (platform) {
      case 'facebook':
        return this.facebookAuthorizeUrl(state, redirectUri);
      case 'linkedin':
        return this.linkedInAuthorizeUrl(state, redirectUri);
      case 'instagram':
        return this.instagramAuthorizeUrl(state, redirectUri);
      case 'google':
        return this.googleAuthorizeUrl(state, redirectUri);
      default:
        throw new BadRequestException(`Unsupported platform: ${platform}`);
    }
  }

  async handleCallback(
    platform: SocialOAuthPlatform,
    code: string,
    redirectUri: string,
  ): Promise<OAuthConnectResult> {
    switch (platform) {
      case 'facebook':
        return this.handleFacebookCallback(code, redirectUri);
      case 'linkedin':
        return this.handleLinkedInCallback(code, redirectUri);
      case 'instagram':
        return this.handleInstagramCallback(code, redirectUri);
      case 'google':
        return this.handleGoogleCallback(code, redirectUri);
      default:
        throw new BadRequestException(`Unsupported platform: ${platform}`);
    }
  }

  private facebookAuthorizeUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.config.getOrThrow<string>('FACEBOOK_APP_ID'),
      redirect_uri: redirectUri,
      state,
      scope: scopesToParam(FACEBOOK_PUBLISHER_SCOPES),
      response_type: 'code',
    });
    return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
  }

  private linkedInAuthorizeUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.getOrThrow<string>('LINKEDIN_CLIENT_ID'),
      redirect_uri: redirectUri,
      scope: scopesToParam(LINKEDIN_PUBLISHER_SCOPES),
      state,
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }

  private instagramAuthorizeUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.config.getOrThrow<string>('FACEBOOK_APP_ID'),
      redirect_uri: redirectUri,
      scope: scopesToParam(INSTAGRAM_PUBLISHER_SCOPES),
      response_type: 'code',
      state,
    });
    return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
  }

  private googleAuthorizeUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopesToParam(GOOGLE_PUBLISHER_SCOPES),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  private async handleFacebookCallback(code: string, redirectUri: string): Promise<OAuthConnectResult> {
    const shortToken = await this.exchangeFacebookCode(code, redirectUri);
    const longLived = await this.exchangeFacebookLongLived(shortToken);
    const profile = await this.getFacebookProfile(longLived.accessToken);

    let metadata: Record<string, unknown> = { profile };
    let externalId = profile.id;
    let accountName = profile.name || 'Facebook Account';

    try {
      const pages = await this.getFacebookPages(longLived.accessToken);
      if (pages.length > 0) {
        const page = pages[0];
        externalId = page.id;
        accountName = page.name || accountName;
        metadata = {
          ...metadata,
          page,
          page_token: page.access_token,
          pages,
        };
      }
    } catch (err) {
      this.logger.warn('Could not fetch Facebook pages', err);
    }

    return {
      platform: 'facebook',
      accountName,
      externalId,
      username: profile.name ?? undefined,
      accessToken: longLived.accessToken,
      expiresAt: longLived.expiresAt,
      metadata,
    };
  }

  private async handleLinkedInCallback(code: string, redirectUri: string): Promise<OAuthConnectResult> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
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
      throw new BadRequestException('LinkedIn token exchange failed');
    }

    const profile = await axios.get<{
      sub?: string;
      email?: string;
      given_name?: string;
      family_name?: string;
    }>('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });

    const p = profile.data;
    return {
      platform: 'linkedin',
      accountName: `${p.given_name ?? ''} ${p.family_name ?? ''}`.trim() || 'LinkedIn Account',
      externalId: p.sub,
      username: p.email,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      metadata: { profile: p, person_id: p.sub },
    };
  }

  private async handleInstagramCallback(code: string, redirectUri: string): Promise<OAuthConnectResult> {
    const shortToken = await this.exchangeFacebookCode(code, redirectUri);
    const longLived = await this.exchangeFacebookLongLived(shortToken);
    const pages = await this.getFacebookPages(longLived.accessToken);

    if (!pages.length) {
      throw new BadRequestException(
        'No Facebook Pages found. Connect a Facebook Page that is linked to your Instagram professional account.',
      );
    }

    for (const page of pages) {
      const pageToken = page.access_token || longLived.accessToken;
      const ig = await this.getInstagramBusinessAccountForPage(page.id, pageToken);
      if (!ig) continue;

      const profile = await this.getInstagramBusinessProfile(ig.id, pageToken);
      return {
        platform: 'instagram',
        accountName: profile.username || profile.name || page.name || 'Instagram Account',
        externalId: profile.id || ig.id,
        username: profile.username,
        accessToken: pageToken,
        expiresAt: longLived.expiresAt,
        metadata: {
          profile,
          page_id: page.id,
          page_name: page.name,
          instagram_business_account_id: ig.id,
        },
      };
    }

    throw new BadRequestException(
      'No Instagram Business account linked to your Facebook Pages. In Meta Business Settings, link an Instagram professional account to a Page, then try again.',
    );
  }

  private async getInstagramBusinessAccountForPage(
    pageId: string,
    pageToken: string,
  ): Promise<{ id: string } | null> {
    try {
      const { data } = await axios.get<{
        instagram_business_account?: { id: string };
        error?: { message: string };
      }>(`https://graph.facebook.com/v19.0/${pageId}`, {
        params: {
          fields: 'instagram_business_account',
          access_token: pageToken,
        },
      });
      if (data.error) {
        this.logger.warn(`Page ${pageId} IG lookup: ${data.error.message}`);
        return null;
      }
      return data.instagram_business_account ?? null;
    } catch (err) {
      this.logger.warn(`Could not load Instagram business account for page ${pageId}`, err);
      return null;
    }
  }

  private async getInstagramBusinessProfile(igBusinessId: string, accessToken: string) {
    const { data } = await axios.get<{
      id?: string;
      username?: string;
      name?: string;
      error?: { message: string };
    }>(`https://graph.facebook.com/v19.0/${igBusinessId}`, {
      params: { fields: 'id,username,name', access_token: accessToken },
    });

    if (data.error || !data.id) {
      throw new BadRequestException(
        data.error?.message || 'Could not load Instagram business profile',
      );
    }
    return data;
  }

  private async handleGoogleCallback(code: string, redirectUri: string): Promise<OAuthConnectResult> {
    const client = new google.auth.OAuth2(
      this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      redirectUri,
    );

    const { tokens } = await client.getToken(code);
    if (!tokens.access_token) {
      throw new BadRequestException('Google token exchange failed');
    }

    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data: profile } = await oauth2.userinfo.get();

    return {
      platform: 'google',
      accountName: profile.email || profile.name || 'Google Account',
      externalId: profile.id ?? undefined,
      username: profile.email ?? undefined,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? undefined,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      metadata: { profile },
    };
  }

  private async exchangeFacebookCode(code: string, redirectUri: string): Promise<string> {
    const params = new URLSearchParams({
      client_id: this.config.getOrThrow<string>('FACEBOOK_APP_ID'),
      client_secret: this.config.getOrThrow<string>('FACEBOOK_APP_SECRET'),
      redirect_uri: redirectUri,
      code,
    });

    const { data } = await axios.get<{ access_token?: string; error?: { message: string } }>(
      `https://graph.facebook.com/v19.0/oauth/access_token?${params.toString()}`,
    );

    if (data.error || !data.access_token) {
      throw new BadRequestException(data.error?.message || 'Facebook code exchange failed');
    }
    return data.access_token;
  }

  private async exchangeFacebookLongLived(accessToken: string) {
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.config.getOrThrow<string>('FACEBOOK_APP_ID'),
      client_secret: this.config.getOrThrow<string>('FACEBOOK_APP_SECRET'),
      fb_exchange_token: accessToken,
    });

    const { data } = await axios.get<{ access_token?: string; expires_in?: number }>(
      `https://graph.facebook.com/v19.0/oauth/access_token?${params.toString()}`,
    );

    if (!data.access_token) {
      throw new BadRequestException('Facebook long-lived token exchange failed');
    }

    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    };
  }

  private async getFacebookProfile(token: string) {
    const { data } = await axios.get<{ id?: string; name?: string }>(
      'https://graph.facebook.com/v19.0/me',
      { params: { fields: 'id,name', access_token: token } },
    );
    return data;
  }

  private async getFacebookPages(token: string) {
    const { data } = await axios.get<{ data?: Array<{ id: string; name: string; access_token?: string }> }>(
      'https://graph.facebook.com/v19.0/me/accounts',
      { params: { access_token: token } },
    );
    return data.data ?? [];
  }
}
