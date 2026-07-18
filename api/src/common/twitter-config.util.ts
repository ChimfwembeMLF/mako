import { ConfigService } from '@nestjs/config';
import {
  TWITTER_PUBLISHER_BASE_SCOPES,
  TWITTER_PUBLISHER_DM_SCOPES,
} from '../modules/social_accounts/social_accounts-oauth.scopes';

/** Central access to X/Twitter env vars (see api/.env). */
export function getTwitterConfig(config: ConfigService) {
  return {
    clientId: config.get<string>('TWITTER_CLIENT_ID')?.trim() ?? '',
    clientSecret: config.get<string>('TWITTER_CLIENT_SECRET')?.trim() ?? '',
    bearerToken: config.get<string>('TWITTER_BEARER_TOKEN')?.trim() ?? '',
    consumerKey: config.get<string>('TWITTER_CONSUMER_KEY')?.trim() ?? '',
    consumerSecret: config.get<string>('TWITTER_CONSUMER_SECRET')?.trim() ?? '',
    oauth1AccessToken:
      config.get<string>('TWITTER_OAUTH1_ACCESS_TOKEN')?.trim() ?? '',
    oauth1AccessTokenSecret:
      config.get<string>('TWITTER_OAUTH1_ACCESS_TOKEN_SECRET')?.trim() ?? '',
    webhookEnv: config.get<string>('TWITTER_WEBHOOK_ENV')?.trim() || 'prod',
    oauthDmScopes:
      config.get<string>('TWITTER_OAUTH_DM_SCOPES')?.trim().toLowerCase() ===
      'true',
  };
}

/** Scopes for Connections OAuth — DM scopes only when app has X DM API access. */
export function resolveTwitterPublisherScopes(config: ConfigService): string[] {
  const scopes: string[] = [...TWITTER_PUBLISHER_BASE_SCOPES];
  if (getTwitterConfig(config).oauthDmScopes) {
    scopes.push(...TWITTER_PUBLISHER_DM_SCOPES);
  }
  return scopes;
}

export function hasTwitterOAuth1AppCreds(config: ConfigService): boolean {
  const c = getTwitterConfig(config);
  return Boolean(c.consumerKey && c.consumerSecret);
}
