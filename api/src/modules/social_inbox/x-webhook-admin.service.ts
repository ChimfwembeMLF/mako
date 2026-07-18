import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { createHmac } from 'crypto';
import {
  getTwitterConfig,
  hasTwitterOAuth1AppCreds,
} from '../../common/twitter-config.util';
import {
  oauth1AuthorizationHeader,
  type OAuth1Credentials,
} from '../../common/oauth1.util';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';

@Injectable()
export class XWebhookAdminService {
  private readonly logger = new Logger(XWebhookAdminService.name);

  constructor(private readonly config: ConfigService) {}

  buildCrcResponse(crcToken: string): string {
    const secret =
      getTwitterConfig(this.config).consumerSecret ||
      getTwitterConfig(this.config).clientSecret;
    if (!secret || !crcToken) {
      throw new Error('Missing CRC token or X app secret');
    }
    const hash = createHmac('sha256', secret)
      .update(crcToken)
      .digest('base64');
    return `sha256=${hash}`;
  }

  getWebhookUrl(apiBaseUrl: string): string {
    const base = (
      this.config.get<string>('API_PUBLIC_URL') ||
      this.config.get<string>('API_BASE_URL') ||
      apiBaseUrl
    ).replace(/\/$/, '');
    return `${base}/api/v1/webhooks/x`;
  }

  /** Best-effort Account Activity registration (requires OAuth 1.0a app + user tokens). */
  async ensureSubscriptionForAccount(
    account: SocialAccounts,
    apiBaseUrl: string,
  ): Promise<{ ok: boolean; message?: string }> {
    if (!hasTwitterOAuth1AppCreds(this.config)) {
      return {
        ok: false,
        message:
          'Set TWITTER_CONSUMER_KEY and TWITTER_CONSUMER_SECRET for webhook subscription',
      };
    }

    const creds = this.oauth1FromAccount(account);
    if (!creds) {
      return {
        ok: false,
        message:
          'OAuth 1.0a user tokens required for Account Activity subscription (manual connect or env TWITTER_OAUTH1_*)',
      };
    }

    const env = getTwitterConfig(this.config).webhookEnv;
    const webhookUrl = this.getWebhookUrl(apiBaseUrl);

    try {
      await this.registerWebhookUrl(env, webhookUrl, creds);
      await this.subscribeUser(env, creds);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`X webhook subscription failed: ${message}`);
      return { ok: false, message };
    }
  }

  private oauth1FromAccount(account: SocialAccounts): OAuth1Credentials | null {
    const cfg = getTwitterConfig(this.config);
    const meta = account.metadata ?? {};

    const consumerKey = String(meta.api_key ?? cfg.consumerKey).trim();
    const consumerSecret = String(meta.api_secret ?? cfg.consumerSecret).trim();
    const token = account.accessToken?.trim() || cfg.oauth1AccessToken;
    const tokenSecret = String(
      meta.access_token_secret ?? cfg.oauth1AccessTokenSecret,
    ).trim();

    if (!consumerKey || !consumerSecret || !token || !tokenSecret) return null;

    return { consumerKey, consumerSecret, token, tokenSecret };
  }

  private async registerWebhookUrl(
    env: string,
    url: string,
    creds: OAuth1Credentials,
  ) {
    const endpoint = `https://api.twitter.com/1.1/account_activity/all/${env}/webhooks.json`;
    const params = { url };
    const auth = oauth1AuthorizationHeader('POST', endpoint, params, creds);

    await axios.post(endpoint, new URLSearchParams(params), {
      headers: {
        Authorization: auth,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      validateStatus: (s) => s === 200 || s === 204 || s === 409,
    });
  }

  private async subscribeUser(env: string, creds: OAuth1Credentials) {
    const endpoint = `https://api.twitter.com/1.1/account_activity/all/${env}/subscriptions.json`;
    const auth = oauth1AuthorizationHeader('POST', endpoint, {}, creds);

    await axios.post(endpoint, null, {
      headers: { Authorization: auth },
      validateStatus: (s) => s === 200 || s === 204 || s === 409,
    });
  }
}
