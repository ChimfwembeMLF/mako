import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import { createHash, randomBytes } from 'crypto';
import { google } from 'googleapis';
import {
  FACEBOOK_PUBLISHER_SCOPES,
  GOOGLE_PUBLISHER_SCOPES,
  INSTAGRAM_PUBLISHER_SCOPES,
  LINKEDIN_PUBLISHER_SCOPES,
  TIKTOK_PUBLISHER_SCOPES,
  TWITTER_PUBLISHER_SCOPES,
  WHATSAPP_PUBLISHER_SCOPES,
  YOUTUBE_PUBLISHER_SCOPES,
  scopesToParam,
  googleScopesToParam,
  twitterScopesToParam,
} from './social_accounts-oauth.scopes';

export type SocialOAuthPlatform =
  | 'facebook'
  | 'linkedin'
  | 'instagram'
  | 'google'
  | 'youtube'
  | 'whatsapp'
  | 'tiktok'
  | 'twitter';

export interface WhatsAppPhoneOption {
  id: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  wabaId: string;
  wabaName?: string;
}

export interface WhatsAppSetupPayload {
  type: 'whatsapp_setup';
  userId: string;
  tenantId: string;
  workspaceId?: string;
  accessToken: string;
  expiresAt?: string;
  phones: WhatsAppPhoneOption[];
}

export interface WhatsAppOAuthPrepareResult {
  accessToken: string;
  expiresAt?: Date;
  phones: WhatsAppPhoneOption[];
}

export interface FacebookPageOption {
  id: string;
  name: string;
  category?: string;
}

export interface FacebookSetupPayload {
  type: 'facebook_setup';
  userId: string;
  tenantId: string;
  workspaceId?: string;
  accessToken: string;
  expiresAt?: string;
  profile: { id?: string; name?: string };
  pages: FacebookPageOption[];
}

export interface FacebookOAuthPrepareResult {
  accessToken: string;
  expiresAt?: Date;
  profile: { id?: string; name?: string };
  pages: FacebookPageOption[];
}

export interface YoutubeChannelOption {
  id: string;
  title: string;
  customUrl?: string;
  thumbnailUrl?: string;
}

export interface YoutubeSetupPayload {
  type: 'youtube_setup';
  userId: string;
  tenantId: string;
  workspaceId?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  profile?: { id?: string; name?: string; email?: string };
  channels: YoutubeChannelOption[];
}

export interface YoutubeOAuthPrepareResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  profile?: { id?: string; name?: string; email?: string };
  channels: YoutubeChannelOption[];
}

export interface OAuthConnectState {
  userId: string;
  tenantId: string;
  workspaceId?: string;
  returnUrl?: string;
  provider: SocialOAuthPlatform;
  redirectUri: string;
  /** OAuth 2.0 PKCE code verifier (TikTok, X/Twitter). */
  codeVerifier?: string;
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

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

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
      return JSON.parse(
        Buffer.from(padded, 'base64').toString('utf8'),
      ) as OAuthConnectState;
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
      this.config.get<string>('API_BASE_URL') || apiBaseUrl
    ).replace(/\/$/, '');

    return `${base}/api/v1/social-accounts/oauth/${platform}/callback`;
  }

  attachTikTokPkce(state: OAuthConnectState): OAuthConnectState {
    const codeVerifier = randomBytes(48).toString('base64url').slice(0, 64);
    return { ...state, codeVerifier };
  }

  /** Alias — X/Twitter OAuth 2.0 also requires PKCE. */
  attachOAuthPkce(state: OAuthConnectState): OAuthConnectState {
    return this.attachTikTokPkce(state);
  }

  getAuthorizeUrl(
    platform: SocialOAuthPlatform,
    state: string,
    redirectUri: string,
    codeVerifier?: string,
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
      case 'youtube':
        return this.youtubeAuthorizeUrl(state, redirectUri);
      case 'whatsapp':
        return this.whatsappAuthorizeUrl(state, redirectUri);
      case 'tiktok':
        if (!codeVerifier) {
          throw new BadRequestException(
            'TikTok OAuth requires PKCE code_verifier',
          );
        }
        return this.tiktokAuthorizeUrl(state, redirectUri, codeVerifier);
      case 'twitter':
        if (!codeVerifier) {
          throw new BadRequestException(
            'X/Twitter OAuth requires PKCE code_verifier',
          );
        }
        return this.twitterAuthorizeUrl(state, redirectUri, codeVerifier);
      default:
        throw new BadRequestException(`Unsupported platform: ${platform}`);
    }
  }

  async handleCallback(
    platform: SocialOAuthPlatform,
    code: string,
    redirectUri: string,
    options?: { codeVerifier?: string },
  ): Promise<OAuthConnectResult> {
    switch (platform) {
      case 'facebook':
        throw new BadRequestException(
          'Facebook uses a separate finalize flow after Page selection',
        );
      case 'linkedin':
        return this.handleLinkedInCallback(code, redirectUri);
      case 'instagram':
        return this.handleInstagramCallback(code, redirectUri);
      case 'google':
        return this.handleGoogleCallback(code, redirectUri);
      case 'youtube':
        throw new BadRequestException(
          'YouTube uses a separate finalize flow after channel selection',
        );
      case 'whatsapp':
        throw new BadRequestException(
          'WhatsApp uses a separate finalize flow after phone selection',
        );
      case 'tiktok':
        return this.handleTikTokCallback(
          code,
          redirectUri,
          options?.codeVerifier,
        );
      case 'twitter':
        return this.handleTwitterCallback(
          code,
          redirectUri,
          options?.codeVerifier,
        );
      default:
        throw new BadRequestException(`Unsupported platform: ${platform}`);
    }
  }

  async prepareWhatsAppConnect(
    code: string,
    redirectUri: string,
  ): Promise<WhatsAppOAuthPrepareResult> {
    const shortToken = await this.exchangeFacebookCode(code, redirectUri);
    const longLived = await this.exchangeFacebookLongLived(shortToken);
    const phones = await this.listWhatsAppPhoneNumbers(longLived.accessToken);

    if (!phones.length) {
      throw new BadRequestException(
        'No WhatsApp Business phone numbers are linked to the Meta account you signed in with. ' +
          'If you are the Mako  operator, configure WHATSAPP_PLATFORM_PHONE_NUMBER_ID and WHATSAPP_PLATFORM_ACCESS_TOKEN on the server so clients can enable WhatsApp without Meta setup. ' +
          'Otherwise your business needs a WhatsApp Business Account in Meta Business Settings (Business settings → WhatsApp accounts), then connect again.',
      );
    }

    return {
      accessToken: longLived.accessToken,
      expiresAt: longLived.expiresAt,
      phones,
    };
  }

  async prepareFacebookConnect(
    code: string,
    redirectUri: string,
  ): Promise<FacebookOAuthPrepareResult> {
    const shortToken = await this.exchangeFacebookCode(code, redirectUri);
    const longLived = await this.exchangeFacebookLongLived(shortToken);
    const profile = await this.getFacebookProfile(longLived.accessToken);
    const pages = await this.getFacebookPages(longLived.accessToken);

    if (!pages.length) {
      throw new BadRequestException(
        'No Facebook Pages found. Sign in with a Meta account that manages at least one Facebook Page, then try again.',
      );
    }

    return {
      accessToken: longLived.accessToken,
      expiresAt: longLived.expiresAt,
      profile,
      pages: pages.map((page) => ({
        id: page.id,
        name: page.name,
        category: page.category,
      })),
    };
  }

  createFacebookSetupToken(
    payload: Omit<FacebookSetupPayload, 'type'>,
  ): string {
    return this.jwtService.sign(
      { type: 'facebook_setup', ...payload },
      { expiresIn: '15m' },
    );
  }

  verifyFacebookSetupToken(token: string): FacebookSetupPayload {
    try {
      const decoded = this.jwtService.verify<FacebookSetupPayload>(token);
      if (decoded.type !== 'facebook_setup') {
        throw new BadRequestException('Invalid Facebook setup token');
      }
      if (
        !decoded.pages?.length ||
        !decoded.accessToken ||
        !decoded.userId ||
        !decoded.tenantId
      ) {
        throw new BadRequestException('Invalid Facebook setup token');
      }
      return decoded;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        'Facebook setup expired — please connect again from Publisher',
      );
    }
  }

  getFacebookSetupPreview(token: string): {
    pages: FacebookPageOption[];
    profileName?: string;
  } {
    const payload = this.verifyFacebookSetupToken(token);
    return {
      pages: payload.pages.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
      })),
      profileName: payload.profile?.name,
    };
  }

  async prepareYoutubeConnect(
    code: string,
    redirectUri: string,
  ): Promise<YoutubeOAuthPrepareResult> {
    const client = this.createGoogleOAuthClient(redirectUri);
    const { tokens } = await client.getToken(code);
    if (!tokens.access_token) {
      throw new BadRequestException('YouTube token exchange failed');
    }

    client.setCredentials(tokens);
    const profile = await this.fetchGoogleProfile(client);
    const channels = await this.listYoutubeChannels(client);

    if (!channels.length) {
      throw new BadRequestException(
        'No YouTube channel found. Create a YouTube channel with this Google account, then connect again.',
      );
    }

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? undefined,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      profile,
      channels,
    };
  }

  createYoutubeSetupToken(payload: Omit<YoutubeSetupPayload, 'type'>): string {
    return this.jwtService.sign(
      { type: 'youtube_setup', ...payload },
      { expiresIn: '15m' },
    );
  }

  verifyYoutubeSetupToken(token: string): YoutubeSetupPayload {
    try {
      const decoded = this.jwtService.verify<YoutubeSetupPayload>(token);
      if (decoded.type !== 'youtube_setup') {
        throw new BadRequestException('Invalid YouTube setup token');
      }
      if (
        !decoded.channels?.length ||
        !decoded.accessToken ||
        !decoded.userId ||
        !decoded.tenantId
      ) {
        throw new BadRequestException('Invalid YouTube setup token');
      }
      return decoded;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        'YouTube setup expired — please connect again from Publisher',
      );
    }
  }

  getYoutubeSetupPreview(token: string): {
    channels: YoutubeChannelOption[];
    profileName?: string;
  } {
    const payload = this.verifyYoutubeSetupToken(token);
    return {
      channels: payload.channels,
      profileName: payload.profile?.name ?? payload.profile?.email,
    };
  }

  buildYoutubeConnectResult(
    payload: YoutubeSetupPayload,
    channelId: string,
  ): OAuthConnectResult {
    const channel = payload.channels.find((c) => c.id === channelId);
    if (!channel) {
      throw new BadRequestException(
        'Selected channel is not available for this setup session',
      );
    }

    return {
      platform: 'youtube',
      accountName: channel.title || 'YouTube Channel',
      externalId: channel.id,
      username: channel.customUrl ?? channel.title,
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : undefined,
      metadata: {
        profile: payload.profile,
        channel_id: channel.id,
        channel_title: channel.title,
        custom_url: channel.customUrl,
        thumbnail_url: channel.thumbnailUrl,
      },
    };
  }

  async buildFacebookConnectResult(
    payload: FacebookSetupPayload,
    pageId: string,
  ): Promise<OAuthConnectResult> {
    const listed = payload.pages.find((p) => p.id === pageId);
    if (!listed) {
      throw new BadRequestException(
        'Selected Page is not available for this setup session',
      );
    }

    const pages = await this.getFacebookPages(payload.accessToken);
    const page = pages.find((p) => p.id === pageId);
    if (!page) {
      throw new BadRequestException(
        'Could not access the selected Page. Confirm you still manage this Page in Meta, then connect again.',
      );
    }

    return {
      platform: 'facebook',
      accountName:
        page.name || listed.name || payload.profile.name || 'Facebook Page',
      externalId: page.id,
      username: payload.profile.name ?? undefined,
      accessToken: payload.accessToken,
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : undefined,
      metadata: {
        profile: payload.profile,
        page: { id: page.id, name: page.name, category: page.category },
        page_id: page.id,
        page_name: page.name,
        page_token: page.access_token,
        pages: pages.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
        })),
      },
    };
  }

  createWhatsAppSetupToken(
    payload: Omit<WhatsAppSetupPayload, 'type'>,
  ): string {
    return this.jwtService.sign(
      { type: 'whatsapp_setup', ...payload },
      { expiresIn: '15m' },
    );
  }

  verifyWhatsAppSetupToken(token: string): WhatsAppSetupPayload {
    try {
      const decoded = this.jwtService.verify<WhatsAppSetupPayload>(token);
      if (decoded.type !== 'whatsapp_setup') {
        throw new BadRequestException('Invalid WhatsApp setup token');
      }
      if (
        !decoded.phones?.length ||
        !decoded.accessToken ||
        !decoded.userId ||
        !decoded.tenantId
      ) {
        throw new BadRequestException('Invalid WhatsApp setup token');
      }
      return decoded;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        'WhatsApp setup expired — please connect again from Publisher',
      );
    }
  }

  getWhatsAppSetupPreview(token: string): { phones: WhatsAppPhoneOption[] } {
    const payload = this.verifyWhatsAppSetupToken(token);
    return {
      phones: payload.phones.map((p) => ({
        id: p.id,
        displayPhoneNumber: p.displayPhoneNumber,
        verifiedName: p.verifiedName,
        wabaId: p.wabaId,
        wabaName: p.wabaName,
      })),
    };
  }

  /** List WABAs / phone numbers reachable with a Meta user or page token. */
  async discoverWhatsAppPhones(
    accessToken: string,
  ): Promise<WhatsAppPhoneOption[]> {
    return this.listWhatsAppPhoneNumbers(accessToken);
  }

  /** True when the token can send WhatsApp messages (not just list via page linkage). */
  async metaTokenHasWhatsAppPermissions(accessToken: string): Promise<boolean> {
    const scopes = await this.debugMetaTokenScopes(accessToken);
    return scopes.includes('whatsapp_business_messaging');
  }

  private async debugMetaTokenScopes(accessToken: string): Promise<string[]> {
    const appId = this.config.get<string>('FACEBOOK_APP_ID');
    const appSecret = this.config.get<string>('FACEBOOK_APP_SECRET');
    if (!appId || !appSecret) return [];

    try {
      const { data } = await axios.get<{
        data?: { scopes?: string[]; is_valid?: boolean };
      }>('https://graph.facebook.com/v19.0/debug_token', {
        params: {
          input_token: accessToken,
          access_token: `${appId}|${appSecret}`,
        },
      });
      if (!data.data?.is_valid) return [];
      return data.data.scopes ?? [];
    } catch (err) {
      this.logger.warn('Meta debug_token failed', err);
      return [];
    }
  }

  private whatsappAuthorizeUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.config.getOrThrow<string>('FACEBOOK_APP_ID'),
      redirect_uri: redirectUri,
      state,
      scope: scopesToParam(WHATSAPP_PUBLISHER_SCOPES),
      response_type: 'code',
    });
    return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
  }

  private async listWhatsAppPhoneNumbers(
    accessToken: string,
  ): Promise<WhatsAppPhoneOption[]> {
    const phones: WhatsAppPhoneOption[] = [];
    const seen = new Set<string>();

    const addPhone = (phone: WhatsAppPhoneOption) => {
      if (seen.has(phone.id)) return;
      seen.add(phone.id);
      phones.push(phone);
    };

    try {
      const { data: bizData } = await axios.get<{
        data?: Array<{ id: string; name?: string }>;
      }>('https://graph.facebook.com/v19.0/me/businesses', {
        params: { fields: 'id,name', access_token: accessToken },
      });

      for (const biz of bizData.data ?? []) {
        try {
          const { data: wabaData } = await axios.get<{
            data?: Array<{ id: string; name?: string }>;
          }>(
            `https://graph.facebook.com/v19.0/${biz.id}/owned_whatsapp_business_accounts`,
            { params: { fields: 'id,name', access_token: accessToken } },
          );

          for (const waba of wabaData.data ?? []) {
            const wabaPhones = await this.getWabaPhoneNumbers(
              accessToken,
              waba.id,
              waba.name,
            );
            wabaPhones.forEach(addPhone);
          }
        } catch (err) {
          this.logger.warn(`Could not load WABAs for business ${biz.id}`, err);
        }
      }
    } catch (err) {
      this.logger.warn('Could not list Meta businesses for WhatsApp', err);
    }

    if (!phones.length) {
      const viaPages = await this.listWhatsAppPhoneNumbersViaPages(accessToken);
      viaPages.forEach(addPhone);
    }

    return phones;
  }

  private async getWabaPhoneNumbers(
    accessToken: string,
    wabaId: string,
    wabaName?: string,
  ): Promise<WhatsAppPhoneOption[]> {
    const { data } = await axios.get<{
      data?: Array<{
        id: string;
        display_phone_number?: string;
        verified_name?: string;
      }>;
    }>(`https://graph.facebook.com/v19.0/${wabaId}/phone_numbers`, {
      params: {
        fields: 'id,display_phone_number,verified_name',
        access_token: accessToken,
      },
    });

    return (data.data ?? []).map((phone) => ({
      id: phone.id,
      displayPhoneNumber: phone.display_phone_number,
      verifiedName: phone.verified_name,
      wabaId,
      wabaName,
    }));
  }

  private async listWhatsAppPhoneNumbersViaPages(
    accessToken: string,
  ): Promise<WhatsAppPhoneOption[]> {
    const phones: WhatsAppPhoneOption[] = [];

    try {
      const pages = await this.getFacebookPages(accessToken);
      for (const page of pages) {
        const pageToken = page.access_token || accessToken;
        try {
          const { data } = await axios.get<{
            whatsapp_business_account?: {
              id: string;
              name?: string;
              phone_numbers?: {
                data?: Array<{
                  id: string;
                  display_phone_number?: string;
                  verified_name?: string;
                }>;
              };
            };
          }>(`https://graph.facebook.com/v19.0/${page.id}`, {
            params: {
              fields:
                'whatsapp_business_account{id,name,phone_numbers{id,display_phone_number,verified_name}}',
              access_token: pageToken,
            },
          });

          const waba = data.whatsapp_business_account;
          if (!waba?.phone_numbers?.data?.length) continue;

          for (const phone of waba.phone_numbers.data) {
            phones.push({
              id: phone.id,
              displayPhoneNumber: phone.display_phone_number,
              verifiedName: phone.verified_name,
              wabaId: waba.id,
              wabaName: waba.name ?? page.name,
            });
          }
        } catch (err) {
          this.logger.warn(`Could not load WhatsApp for page ${page.id}`, err);
        }
      }
    } catch (err) {
      this.logger.warn(
        'Could not list Facebook pages for WhatsApp fallback',
        err,
      );
    }

    return phones;
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
      scope: googleScopesToParam(GOOGLE_PUBLISHER_SCOPES),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  private youtubeAuthorizeUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: googleScopesToParam(YOUTUBE_PUBLISHER_SCOPES),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  private async handleLinkedInCallback(
    code: string,
    redirectUri: string,
  ): Promise<OAuthConnectResult> {
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
      accountName:
        `${p.given_name ?? ''} ${p.family_name ?? ''}`.trim() ||
        'LinkedIn Account',
      externalId: p.sub,
      username: p.email,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
      metadata: { profile: p, person_id: p.sub },
    };
  }

  private async handleInstagramCallback(
    code: string,
    redirectUri: string,
  ): Promise<OAuthConnectResult> {
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
      const ig = await this.getInstagramBusinessAccountForPage(
        page.id,
        pageToken,
      );
      if (!ig) continue;

      const profile = await this.getInstagramBusinessProfile(ig.id, pageToken);
      return {
        platform: 'instagram',
        accountName:
          profile.username || profile.name || page.name || 'Instagram Account',
        externalId: profile.id || ig.id,
        username: profile.username,
        accessToken: pageToken,
        expiresAt: longLived.expiresAt,
        metadata: {
          profile,
          page_id: page.id,
          page_name: page.name,
          page_token: pageToken,
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
      this.logger.warn(
        `Could not load Instagram business account for page ${pageId}`,
        err,
      );
      return null;
    }
  }

  private async getInstagramBusinessProfile(
    igBusinessId: string,
    accessToken: string,
  ) {
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

  private async handleGoogleCallback(
    code: string,
    redirectUri: string,
  ): Promise<OAuthConnectResult> {
    const client = this.createGoogleOAuthClient(redirectUri);

    const { tokens } = await client.getToken(code);
    if (!tokens.access_token) {
      throw new BadRequestException('Google token exchange failed');
    }

    client.setCredentials(tokens);
    const profile = await this.fetchGoogleProfile(client);

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

  private createGoogleOAuthClient(redirectUri: string) {
    return new google.auth.OAuth2(
      this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      redirectUri,
    );
  }

  private async fetchGoogleProfile(
    client: InstanceType<typeof google.auth.OAuth2>,
  ) {
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data: profile } = await oauth2.userinfo.get();
    return {
      id: profile.id ?? undefined,
      name: profile.name ?? undefined,
      email: profile.email ?? undefined,
    };
  }

  private async listYoutubeChannels(
    client: InstanceType<typeof google.auth.OAuth2>,
  ): Promise<YoutubeChannelOption[]> {
    const youtube = google.youtube({ version: 'v3', auth: client });
    const { data } = await youtube.channels.list({
      part: ['snippet'],
      mine: true,
      maxResults: 25,
    });

    return (data.items ?? [])
      .filter((item) => item.id)
      .map((item) => ({
        id: item.id!,
        title: item.snippet?.title ?? 'YouTube Channel',
        customUrl: item.snippet?.customUrl ?? undefined,
        thumbnailUrl: item.snippet?.thumbnails?.default?.url ?? undefined,
      }));
  }

  private async exchangeFacebookCode(
    code: string,
    redirectUri: string,
  ): Promise<string> {
    const params = new URLSearchParams({
      client_id: this.config.getOrThrow<string>('FACEBOOK_APP_ID'),
      client_secret: this.config.getOrThrow<string>('FACEBOOK_APP_SECRET'),
      redirect_uri: redirectUri,
      code,
    });

    const { data } = await axios.get<{
      access_token?: string;
      error?: { message: string };
    }>(
      `https://graph.facebook.com/v19.0/oauth/access_token?${params.toString()}`,
    );

    if (data.error || !data.access_token) {
      throw new BadRequestException(
        data.error?.message || 'Facebook code exchange failed',
      );
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

    const { data } = await axios.get<{
      access_token?: string;
      expires_in?: number;
    }>(
      `https://graph.facebook.com/v19.0/oauth/access_token?${params.toString()}`,
    );

    if (!data.access_token) {
      throw new BadRequestException(
        'Facebook long-lived token exchange failed',
      );
    }

    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
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
    const { data } = await axios.get<{
      data?: Array<{
        id: string;
        name: string;
        category?: string;
        access_token?: string;
      }>;
    }>('https://graph.facebook.com/v19.0/me/accounts', {
      params: { fields: 'id,name,category,access_token', access_token: token },
    });
    return data.data ?? [];
  }

  private tiktokAuthorizeUrl(
    state: string,
    redirectUri: string,
    codeVerifier: string,
  ): string {
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    const params = new URLSearchParams({
      client_key: this.config.getOrThrow<string>('TIKTOK_CLIENT_KEY'),
      redirect_uri: redirectUri,
      scope: scopesToParam(TIKTOK_PUBLISHER_SCOPES),
      response_type: 'code',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  }

  private async handleTikTokCallback(
    code: string,
    redirectUri: string,
    codeVerifier?: string,
  ): Promise<OAuthConnectResult> {
    const tokens = await this.exchangeTikTokAuthorizationCode(
      code,
      redirectUri,
      codeVerifier,
    );
    const profile = await this.fetchTikTokUserProfile(tokens.accessToken);

    const displayName =
      profile.display_name?.trim() ||
      profile.username?.trim() ||
      'TikTok Account';

    return {
      platform: 'tiktok',
      accountName: displayName,
      externalId: tokens.openId || profile.open_id,
      username: profile.username,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      metadata: {
        open_id: tokens.openId || profile.open_id,
        union_id: profile.union_id,
        avatar_url: profile.avatar_url,
        username: profile.username,
        scope: tokens.scope,
        refresh_expires_at: tokens.refreshExpiresAt?.toISOString(),
      },
    };
  }

  async refreshTikTokAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    refreshExpiresAt?: Date;
  }> {
    const body = new URLSearchParams({
      client_key: this.config.getOrThrow<string>('TIKTOK_CLIENT_KEY'),
      client_secret: this.config.getOrThrow<string>('TIKTOK_CLIENT_SECRET'),
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const { data } = await axios.post<TikTokTokenEnvelope>(
      'https://open.tiktokapis.com/v2/oauth/token/',
      body.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    const tokenData = this.parseTikTokTokenResponse(data);
    return tokenData;
  }

  private async exchangeTikTokAuthorizationCode(
    code: string,
    redirectUri: string,
    codeVerifier?: string,
  ) {
    const body = new URLSearchParams({
      client_key: this.config.getOrThrow<string>('TIKTOK_CLIENT_KEY'),
      client_secret: this.config.getOrThrow<string>('TIKTOK_CLIENT_SECRET'),
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });
    if (codeVerifier) {
      body.set('code_verifier', codeVerifier);
    }

    const { data } = await axios.post<TikTokTokenEnvelope>(
      'https://open.tiktokapis.com/v2/oauth/token/',
      body.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    return this.parseTikTokTokenResponse(data);
  }

  private parseTikTokTokenResponse(body: TikTokTokenEnvelope) {
    if (typeof body.error === 'string') {
      throw new BadRequestException(
        body.error_description || body.error || 'TikTok token exchange failed',
      );
    }
    if (body.error?.code && body.error.code !== 'ok') {
      throw new BadRequestException(
        body.error.message || `TikTok token error: ${body.error.code}`,
      );
    }

    const token = body.access_token ? body : body.data;
    if (!token?.access_token) {
      throw new BadRequestException('TikTok token exchange failed');
    }

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      openId: token.open_id,
      scope: token.scope,
      expiresAt: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000)
        : undefined,
      refreshExpiresAt: token.refresh_expires_in
        ? new Date(Date.now() + token.refresh_expires_in * 1000)
        : undefined,
    };
  }

  private async fetchTikTokUserProfile(accessToken: string): Promise<{
    open_id?: string;
    union_id?: string;
    avatar_url?: string;
    display_name?: string;
    username?: string;
  }> {
    const { data } = await axios.get<{
      data?: { user?: Record<string, string> };
      error?: { code?: string; message?: string };
    }>('https://open.tiktokapis.com/v2/user/info/', {
      params: { fields: 'open_id,union_id,avatar_url,display_name,username' },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (data.error?.code && data.error.code !== 'ok') {
      this.logger.warn(
        `TikTok user info failed: ${data.error.message ?? data.error.code}`,
      );
      return {};
    }

    return data.data?.user ?? {};
  }

  private twitterAuthorizeUrl(
    state: string,
    redirectUri: string,
    codeVerifier: string,
  ): string {
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.getOrThrow<string>('TWITTER_CLIENT_ID'),
      redirect_uri: redirectUri,
      scope: twitterScopesToParam(TWITTER_PUBLISHER_SCOPES),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
  }

  private async handleTwitterCallback(
    code: string,
    redirectUri: string,
    codeVerifier?: string,
  ): Promise<OAuthConnectResult> {
    if (!codeVerifier) {
      throw new BadRequestException('X/Twitter OAuth requires PKCE code_verifier');
    }

    const tokens = await this.exchangeTwitterAuthorizationCode(
      code,
      redirectUri,
      codeVerifier,
    );
    const profile = await this.fetchTwitterUserProfile(tokens.accessToken);

    const displayName =
      profile.name?.trim() ||
      (profile.username ? `@${profile.username}` : 'X Account');

    return {
      platform: 'twitter',
      accountName: displayName,
      externalId: profile.id,
      username: profile.username,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      metadata: {
        auth_type: 'oauth2',
        username: profile.username,
        profile_image_url: profile.profile_image_url,
        scope: tokens.scope,
      },
    };
  }

  async refreshTwitterAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }> {
    const clientId = this.config.getOrThrow<string>('TWITTER_CLIENT_ID');
    const clientSecret = this.config.getOrThrow<string>('TWITTER_CLIENT_SECRET');
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const { data } = await axios.post<{
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    }>('https://api.twitter.com/2/oauth2/token', body.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
    });

    if (data.error || !data.access_token) {
      throw new BadRequestException(
        data.error_description || data.error || 'X/Twitter token refresh failed',
      );
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    };
  }

  private async exchangeTwitterAuthorizationCode(
    code: string,
    redirectUri: string,
    codeVerifier: string,
  ) {
    const clientId = this.config.getOrThrow<string>('TWITTER_CLIENT_ID');
    const clientSecret = this.config.getOrThrow<string>('TWITTER_CLIENT_SECRET');
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    const { data } = await axios.post<{
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      error?: string;
      error_description?: string;
    }>('https://api.twitter.com/2/oauth2/token', body.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
    });

    if (data.error || !data.access_token) {
      throw new BadRequestException(
        data.error_description ||
          data.error ||
          'X/Twitter token exchange failed',
      );
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      scope: data.scope,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    };
  }

  private async fetchTwitterUserProfile(accessToken: string): Promise<{
    id?: string;
    name?: string;
    username?: string;
    profile_image_url?: string;
  }> {
    const { data } = await axios.get<{
      data?: {
        id?: string;
        name?: string;
        username?: string;
        profile_image_url?: string;
      };
      errors?: Array<{ message?: string }>;
    }>('https://api.twitter.com/2/users/me', {
      params: { 'user.fields': 'profile_image_url,username,name' },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (data.errors?.length) {
      this.logger.warn(
        `X user info failed: ${data.errors[0]?.message ?? 'unknown'}`,
      );
      return {};
    }

    return data.data ?? {};
  }
}

type TikTokTokenEnvelope = {
  access_token?: string;
  refresh_token?: string;
  open_id?: string;
  scope?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  error?: string | { code?: string; message?: string };
  error_description?: string;
  data?: {
    access_token?: string;
    refresh_token?: string;
    open_id?: string;
    scope?: string;
    expires_in?: number;
    refresh_expires_in?: number;
  };
};
