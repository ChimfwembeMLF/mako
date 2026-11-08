import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import { META_GRAPH_VERSION } from '../../common/meta-graph-version';
import type { OAuthConnectResult } from './social_accounts-oauth.service';
import {
  decryptToken,
  encryptToken,
} from '../../common/utils/token-crypto.util';

/** Sign-in flows for the newer channels. Each needs its app approved by the network. */
export const CONNECTOR_PROVIDERS = [
  'instagram_login',
  'threads',
  'linkedin_page',
  'pinterest',
  'google_business',
] as const;
export type ConnectorProvider = (typeof CONNECTOR_PROVIDERS)[number];

export const isConnectorProvider = (p: string): p is ConnectorProvider =>
  (CONNECTOR_PROVIDERS as readonly string[]).includes(p);

export const CONNECTOR_SCOPES: Record<ConnectorProvider, string[]> = {
  instagram_login: [
    'instagram_business_basic',
    'instagram_business_content_publish',
    'instagram_business_manage_comments',
    'instagram_business_manage_messages',
  ],
  threads: ['threads_basic', 'threads_content_publish'],
  linkedin_page: [
    'openid',
    'profile',
    'w_organization_social',
    'r_organization_social',
    'rw_organization_admin',
  ],
  pinterest: ['boards:read', 'pins:read', 'pins:write', 'user_accounts:read'],
  google_business: [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/business.manage',
  ],
};

/** One thing the user can pick after signing in (a company Page, a board, a location). */
export type ChannelChoice = {
  id: string;
  name: string;
  subtitle?: string;
  /** What the connected account is saved as if this one is picked. */
  account: Omit<
    OAuthConnectResult,
    'accessToken' | 'refreshToken' | 'expiresAt'
  >;
};

export type ConnectorResult =
  | { kind: 'single'; result: OAuthConnectResult }
  | {
      kind: 'choose';
      platform: string;
      title: string;
      accessToken: string;
      refreshToken?: string;
      expiresAt?: string;
      choices: ChannelChoice[];
    };

export type ChannelSetupPayload = {
  type: 'channel_setup';
  userId: string;
  tenantId: string;
  workspaceId?: string;
  platform: string;
  title: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  choices: ChannelChoice[];
};

const form = (data: Record<string, string>) =>
  new URLSearchParams(data).toString();
const FORM = {
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  timeout: 20_000,
};
const expiresIn = (seconds?: number) =>
  seconds ? new Date(Date.now() + seconds * 1000) : undefined;

@Injectable()
export class ChannelConnectorsService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  private creds(provider: ConnectorProvider): { id: string; secret: string } {
    const keys: Record<ConnectorProvider, [string, string]> = {
      instagram_login: ['INSTAGRAM_LOGIN_APP_ID', 'INSTAGRAM_LOGIN_APP_SECRET'],
      threads: ['THREADS_APP_ID', 'THREADS_APP_SECRET'],
      linkedin_page: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
      pinterest: ['PINTEREST_APP_ID', 'PINTEREST_APP_SECRET'],
      google_business: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    };
    const [idKey, secretKey] = keys[provider];
    const id = this.config.get<string>(idKey)?.trim();
    const secret = this.config.get<string>(secretKey)?.trim();
    if (!id || !secret) {
      throw new BadRequestException(
        `${provider.replace(
          '_',
          ' ',
        )} isn't set up on this server yet (missing ${idKey} / ${secretKey}).`,
      );
    }
    return { id, secret };
  }

  authorizeUrl(
    provider: ConnectorProvider,
    state: string,
    redirectUri: string,
  ): string {
    const { id } = this.creds(provider);
    const scope = CONNECTOR_SCOPES[provider];
    const q = (base: string, params: Record<string, string>) =>
      `${base}?${new URLSearchParams(params).toString()}`;
    switch (provider) {
      case 'instagram_login':
        return q('https://www.instagram.com/oauth/authorize', {
          client_id: id,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: scope.join(','),
          state,
        });
      case 'threads':
        return q('https://threads.net/oauth/authorize', {
          client_id: id,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: scope.join(','),
          state,
        });
      case 'linkedin_page':
        return q('https://www.linkedin.com/oauth/v2/authorization', {
          client_id: id,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: scope.join(' '),
          state,
        });
      case 'pinterest':
        return q('https://www.pinterest.com/oauth/', {
          client_id: id,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: scope.join(','),
          state,
        });
      case 'google_business':
        return q('https://accounts.google.com/o/oauth2/v2/auth', {
          client_id: id,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: scope.join(' '),
          access_type: 'offline',
          prompt: 'consent',
          state,
        });
    }
  }

  /** Exchanges the code and works out what can be connected. */
  async prepare(
    provider: ConnectorProvider,
    code: string,
    redirectUri: string,
  ): Promise<ConnectorResult> {
    const { id, secret } = this.creds(provider);
    switch (provider) {
      case 'instagram_login': {
        const { data: short } = await axios.post(
          'https://api.instagram.com/oauth/access_token',
          form({
            client_id: id,
            client_secret: secret,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
            code,
          }),
          FORM,
        );
        const { data: long } = await axios.get(
          'https://graph.instagram.com/access_token',
          {
            params: {
              grant_type: 'ig_exchange_token',
              client_secret: secret,
              access_token: short.access_token,
            },
            timeout: 20_000,
          },
        );
        const { data: me } = await axios.get(
          `https://graph.instagram.com/${META_GRAPH_VERSION}/me`,
          {
            params: {
              fields: 'user_id,username,name',
              access_token: long.access_token,
            },
            timeout: 20_000,
          },
        );
        return {
          kind: 'single',
          result: {
            platform: 'instagram',
            accountName: me.username || me.name || 'Instagram',
            username: me.username,
            externalId: String(me.user_id ?? short.user_id),
            accessToken: long.access_token,
            expiresAt: expiresIn(long.expires_in),
            metadata: {
              login_type: 'instagram',
              instagram_business_account_id: String(
                me.user_id ?? short.user_id,
              ),
              scope: CONNECTOR_SCOPES.instagram_login.join(','),
            },
          },
        };
      }
      case 'threads': {
        const { data: short } = await axios.post(
          'https://graph.threads.net/oauth/access_token',
          form({
            client_id: id,
            client_secret: secret,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
            code,
          }),
          FORM,
        );
        const { data: long } = await axios.get(
          'https://graph.threads.net/access_token',
          {
            params: {
              grant_type: 'th_exchange_token',
              client_secret: secret,
              access_token: short.access_token,
            },
            timeout: 20_000,
          },
        );
        const { data: me } = await axios.get(
          'https://graph.threads.net/v1.0/me',
          {
            params: {
              fields: 'id,username,name',
              access_token: long.access_token,
            },
            timeout: 20_000,
          },
        );
        return {
          kind: 'single',
          result: {
            platform: 'threads',
            accountName: me.username || me.name || 'Threads',
            username: me.username,
            externalId: String(me.id ?? short.user_id),
            accessToken: long.access_token,
            expiresAt: expiresIn(long.expires_in),
            metadata: { scope: CONNECTOR_SCOPES.threads.join(',') },
          },
        };
      }
      case 'linkedin_page': {
        const { data: tok } = await axios.post(
          'https://www.linkedin.com/oauth/v2/accessToken',
          form({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            client_id: id,
            client_secret: secret,
          }),
          FORM,
        );
        const { data } = await axios.get(
          'https://api.linkedin.com/v2/organizationAcls',
          {
            params: {
              q: 'roleAssignee',
              role: 'ADMINISTRATOR',
              state: 'APPROVED',
              projection:
                '(elements*(organization~(id,localizedName,vanityName)))',
            },
            headers: {
              Authorization: `Bearer ${tok.access_token}`,
              'X-Restli-Protocol-Version': '2.0.0',
            },
            timeout: 20_000,
          },
        );
        const choices: ChannelChoice[] = (
          (data?.elements ?? []) as Array<{
            'organization~'?: {
              id: number;
              localizedName?: string;
              vanityName?: string;
            };
          }>
        )
          .map((e) => e['organization~'])
          .filter(
            (
              o,
            ): o is {
              id: number;
              localizedName?: string;
              vanityName?: string;
            } => Boolean(o?.id),
          )
          .map((o) => ({
            id: String(o.id),
            name: o.localizedName || `Company ${o.id}`,
            subtitle: o.vanityName
              ? `linkedin.com/company/${o.vanityName}`
              : undefined,
            account: {
              platform: 'linkedin',
              accountName: o.localizedName || `Company ${o.id}`,
              username: o.vanityName,
              externalId: `org-${o.id}`,
              metadata: {
                organization_id: String(o.id),
                kind: 'page',
                scope: tok.scope ?? CONNECTOR_SCOPES.linkedin_page.join(' '),
              },
            },
          }));
        return {
          kind: 'choose',
          platform: 'linkedin',
          title: 'Choose a LinkedIn company Page',
          accessToken: tok.access_token,
          refreshToken: tok.refresh_token,
          expiresAt: expiresIn(tok.expires_in)?.toISOString(),
          choices,
        };
      }
      case 'pinterest': {
        const { data: tok } = await axios.post(
          'https://api.pinterest.com/v5/oauth/token',
          form({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
          }),
          { ...FORM, auth: { username: id, password: secret } },
        );
        const headers = { Authorization: `Bearer ${tok.access_token}` };
        const [{ data: me }, { data: boards }] = await Promise.all([
          axios.get('https://api.pinterest.com/v5/user_account', {
            headers,
            timeout: 20_000,
          }),
          axios.get('https://api.pinterest.com/v5/boards', {
            headers,
            params: { page_size: 100 },
            timeout: 20_000,
          }),
        ]);
        const choices: ChannelChoice[] = (
          (boards?.items ?? []) as Array<{
            id: string;
            name: string;
            privacy?: string;
          }>
        ).map((b) => ({
          id: b.id,
          name: b.name,
          subtitle: b.privacy === 'SECRET' ? 'Secret board' : undefined,
          account: {
            platform: 'pinterest',
            accountName: `${b.name}`,
            username: me?.username,
            externalId: b.id,
            metadata: {
              board_id: b.id,
              board_name: b.name,
              pinterest_username: me?.username,
              scope: tok.scope ?? CONNECTOR_SCOPES.pinterest.join(','),
            },
          },
        }));
        return {
          kind: 'choose',
          platform: 'pinterest',
          title: 'Choose a Pinterest board',
          accessToken: tok.access_token,
          refreshToken: tok.refresh_token,
          expiresAt: expiresIn(tok.expires_in)?.toISOString(),
          choices,
        };
      }
      case 'google_business': {
        const { data: tok } = await axios.post(
          'https://oauth2.googleapis.com/token',
          form({
            code,
            client_id: id,
            client_secret: secret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
          FORM,
        );
        const headers = { Authorization: `Bearer ${tok.access_token}` };
        const { data: accts } = await axios.get(
          'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
          { headers, timeout: 20_000 },
        );
        const choices: ChannelChoice[] = [];
        for (const acct of (accts?.accounts ?? []) as Array<{
          name: string;
          accountName?: string;
        }>) {
          const { data: locs } = await axios.get(
            `https://mybusinessbusinessinformation.googleapis.com/v1/${acct.name}/locations`,
            {
              headers,
              params: {
                readMask: 'name,title,storefrontAddress',
                pageSize: 100,
              },
              timeout: 20_000,
            },
          );
          for (const loc of (locs?.locations ?? []) as Array<{
            name: string;
            title?: string;
            storefrontAddress?: { locality?: string; addressLines?: string[] };
          }>) {
            const locationName = `${acct.name}/${loc.name}`;
            choices.push({
              id: locationName,
              name: loc.title || loc.name,
              subtitle:
                [
                  loc.storefrontAddress?.addressLines?.[0],
                  loc.storefrontAddress?.locality,
                ]
                  .filter(Boolean)
                  .join(', ') || acct.accountName,
              account: {
                platform: 'google_business',
                accountName: loc.title || loc.name,
                externalId: locationName,
                metadata: {
                  location_name: locationName,
                  google_account: acct.name,
                  scope: tok.scope,
                },
              },
            });
          }
        }
        return {
          kind: 'choose',
          platform: 'google_business',
          title: 'Choose a business location',
          accessToken: tok.access_token,
          refreshToken: tok.refresh_token,
          expiresAt: expiresIn(tok.expires_in)?.toISOString(),
          choices,
        };
      }
    }
  }

  /**
   * The token travels through the browser URL, so the network tokens and choices are
   * sealed (AES-GCM) inside the signed JWT and can't be read from it.
   */
  createSetupToken(payload: Omit<ChannelSetupPayload, 'type'>): string {
    return this.jwt.sign(
      { type: 'channel_setup', sealed: encryptToken(JSON.stringify(payload)) },
      { expiresIn: '15m' },
    );
  }

  verifySetupToken(token: string): ChannelSetupPayload {
    try {
      const outer = this.jwt.verify<{ type?: string; sealed?: string }>(token);
      if (outer.type !== 'channel_setup' || !outer.sealed)
        throw new Error('wrong type');
      return {
        ...(JSON.parse(decryptToken(outer.sealed)) as Omit<
          ChannelSetupPayload,
          'type'
        >),
        type: 'channel_setup',
      };
    } catch {
      throw new BadRequestException(
        'This setup link has expired. Start connecting again.',
      );
    }
  }
}
