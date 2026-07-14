import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';

import {
  resolveApiPublicUrl,
  resolveFrontendUrl,
} from '../../common/env-urls.util';
import { UserService } from '../user/user.service';
import { GMAIL_OAUTH_SCOPES } from './gmail-scopes';
import { GmailInboxSyncService } from './gmail-inbox-sync.service';

type GmailLinkState = {
  userId: string;
  tenantId?: string;
  workspaceId?: string;
  returnUrl?: string;
};

@Injectable()
export class GmailConnectService {
  constructor(
    private readonly config: ConfigService,
    private readonly userService: UserService,
    private readonly inboxSync: GmailInboxSyncService,
  ) {}

  private gmailCallbackUrl(): string {
    const fromEnv = this.config.get<string>('GOOGLE_GMAIL_CALLBACK_URL')?.trim();
    if (fromEnv) return fromEnv.replace(/\/$/, '');

    const apiBase = resolveApiPublicUrl(this.config);
    if (apiBase) return `${apiBase}/api/v1/mail/gmail/callback`;

    return 'http://localhost:4000/api/v1/mail/gmail/callback';
  }

  private encodeLinkState(state: GmailLinkState): string {
    return Buffer.from(JSON.stringify(state)).toString('base64url');
  }

  private decodeLinkState(raw: string): GmailLinkState | null {
    let value = raw.trim();
    for (let i = 0; i < 3 && value.includes('%'); i++) {
      value = decodeURIComponent(value);
    }
    try {
      return JSON.parse(
        Buffer.from(value, 'base64url').toString('utf8'),
      ) as GmailLinkState;
    } catch {
      return null;
    }
  }

  private appendQuery(base: string, key: string, value: string): string {
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}${key}=${encodeURIComponent(value)}`;
  }

  async getStatus(userId: string, smtpConfigured: boolean) {
    const user = await this.userService.findOne({ id: userId });
    if (!user) throw new BadRequestException('User not found');

    const tokens = await this.userService.getGoogleOAuthTokens(userId);
    return {
      connected: !!tokens,
      email: user.email,
      expiresAt: tokens?.expiresAt?.toISOString() ?? null,
      smtpConfigured,
      inboxAutoReply: !!tokens,
      inboxScopeNote: tokens
        ? 'Reconnect Gmail if auto-reply does not run (inbox read permission may be missing on older connections).'
        : null,
    };
  }

  getConnectUrl(
    userId: string,
    options?: { returnUrl?: string; tenantId?: string; workspaceId?: string },
  ) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')?.trim();
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET')?.trim();
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'Google OAuth is not configured on the server',
      );
    }

    const redirectUri = this.gmailCallbackUrl();
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const state = this.encodeLinkState({
      userId,
      tenantId: options?.tenantId,
      workspaceId: options?.workspaceId,
      returnUrl: options?.returnUrl,
    });
    const redirectUrl = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [...GMAIL_OAUTH_SCOPES],
      state,
    });

    return { redirectUrl, redirectUri };
  }

  async handleCallback(params: {
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
  }): Promise<{ redirectUrl: string }> {
    const fallbackReturn = `${resolveFrontendUrl(this.config)}/mail`;

    if (params.error) {
      const message = params.error_description || params.error;
      return { redirectUrl: this.appendQuery(fallbackReturn, 'error', message) };
    }

    const code = params.code?.trim();
    const rawState = params.state?.trim();
    if (!code || !rawState) {
      return {
        redirectUrl: this.appendQuery(
          fallbackReturn,
          'error',
          'Missing authorization code or state',
        ),
      };
    }

    const linkState = this.decodeLinkState(rawState);
    if (!linkState?.userId) {
      return {
        redirectUrl: this.appendQuery(
          fallbackReturn,
          'error',
          'Invalid OAuth state — try connecting again',
        ),
      };
    }

    const returnUrl = linkState.returnUrl?.trim() || fallbackReturn;

    try {
      const clientId = this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');
      const clientSecret = this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
      const redirectUri = this.gmailCallbackUrl();
      const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
      const { tokens } = await oauth2.getToken(code);
      if (!tokens.access_token) {
        throw new BadRequestException('Google token exchange failed');
      }

      const expiresAt = tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : new Date(Date.now() + 55 * 60 * 1000);

      await this.userService.updateGoogleOAuthTokens(linkState.userId, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        expiresAt,
      });

      if (linkState.tenantId) {
        await this.inboxSync.upsertConnection({
          tenantId: linkState.tenantId,
          userId: linkState.userId,
          workspaceId: linkState.workspaceId,
        });
      }

      return { redirectUrl: this.appendQuery(returnUrl, 'connected', '1') };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Gmail connection failed';
      return { redirectUrl: this.appendQuery(returnUrl, 'error', message) };
    }
  }

  async disconnect(userId: string) {
    await this.userService.clearGoogleOAuthTokens(userId);
    await this.inboxSync.deactivateForUser(userId);
    return { success: true };
  }
}
