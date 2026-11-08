import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios, { AxiosError } from 'axios';
import { SocialAccounts } from './entities/social_accounts.entity';
import { SocialAccountsService } from './social_accounts.service';
import { META_GRAPH_VERSION } from '../../common/meta-graph-version';

export type AccountFeature =
  | 'Posts'
  | 'Comments'
  | 'Messages'
  | 'Ads'
  | 'Drive';

export type AccountHealth = {
  /** ok: works; revoked: access gone, reconnect; error: couldn't reach the network; unchecked: can't be checked automatically. */
  status: 'ok' | 'revoked' | 'error' | 'unchecked';
  message: string;
  checkedAt: string;
  /** Features that won't work because a permission wasn't granted. */
  missing: Array<{ feature: AccountFeature; permissions: string[] }>;
};

/** The permissions each feature needs, per platform. */
const FEATURE_PERMISSIONS: Record<
  string,
  Partial<Record<AccountFeature, string[]>>
> = {
  facebook: {
    Posts: ['pages_manage_posts', 'pages_show_list'],
    Comments: ['pages_read_engagement', 'pages_manage_engagement'],
  },
  instagram: {
    Posts: ['instagram_basic', 'instagram_content_publish'],
    Comments: ['instagram_manage_comments'],
    Messages: ['instagram_manage_messages'],
  },
  youtube: {
    Posts: ['https://www.googleapis.com/auth/youtube.upload'],
    Comments: ['https://www.googleapis.com/auth/youtube.force-ssl'],
  },
  google: {
    Ads: ['https://www.googleapis.com/auth/adwords'],
    Drive: ['https://www.googleapis.com/auth/drive.readonly'],
  },
  instagram_login: {
    Posts: ['instagram_business_basic', 'instagram_business_content_publish'],
    Comments: ['instagram_business_manage_comments'],
    Messages: ['instagram_business_manage_messages'],
  },
  threads: { Posts: ['threads_basic', 'threads_content_publish'] },
  pinterest: { Posts: ['boards:read', 'pins:write'] },
  google_business: {
    Posts: ['https://www.googleapis.com/auth/business.manage'],
  },
  tiktok: { Posts: ['video.publish'] },
  twitter: { Posts: ['tweet.write'], Messages: ['dm.read', 'dm.write'] },
};

/** Which permissions are missing for each feature, given what was granted. */
export function missingPermissions(
  platform: string,
  granted: string[] | null,
): AccountHealth['missing'] {
  if (!granted) return [];
  const needs =
    FEATURE_PERMISSIONS[platform === 'x' ? 'twitter' : platform] ?? {};
  const have = new Set(granted);
  return (Object.entries(needs) as Array<[AccountFeature, string[]]>)
    .map(([feature, perms]) => ({
      feature,
      permissions: perms.filter((p) => !have.has(p)),
    }))
    .filter((m) => m.permissions.length > 0);
}

/** Access refused (expired, revoked, password changed, admin removed) vs. any other failure. */
export function isAccessRefused(err: unknown): boolean {
  const e = err as AxiosError<{ error?: { code?: number; type?: string } }>;
  const status = e?.response?.status;
  const metaCode = e?.response?.data?.error?.code;
  // 401, or Meta's "token expired / invalid session" codes. A permission error (403,
  // Meta code 200) means a missing permission, not lost access.
  return status === 401 || metaCode === 190 || metaCode === 102;
}

@Injectable()
export class SocialAccountHealthService {
  private readonly logger = new Logger(SocialAccountHealthService.name);

  constructor(
    @InjectRepository(SocialAccounts)
    private readonly repo: Repository<SocialAccounts>,
    private readonly accounts: SocialAccountsService,
  ) {}

  /** Checks one account against its network and saves the result on it. */
  async check(account: SocialAccounts): Promise<AccountHealth> {
    let health: AccountHealth;
    try {
      const fresh = await this.accounts.refreshAccessTokenIfNeeded(account);
      health = await this.probe(fresh);
    } catch (err) {
      const refused = isAccessRefused(err);
      health = {
        status: refused ? 'revoked' : 'error',
        message: refused
          ? 'Access was removed or has expired. Reconnect to keep posting.'
          : `Couldn't reach ${account.platform} just now. We'll try again.`,
        checkedAt: new Date().toISOString(),
        missing: [],
      };
      if (!refused)
        this.logger.warn(
          `Health check for ${account.platform} ${account.id} failed: ${
            (err as Error)?.message
          }`,
        );
    }
    account.metadata = { ...(account.metadata ?? {}), health };
    await this.repo.save(account);
    return health;
  }

  private async probe(account: SocialAccounts): Promise<AccountHealth> {
    const meta = (account.metadata ?? {}) as Record<string, unknown>;
    const token =
      account.accessToken || (meta.access_token as string | undefined) || '';
    const now = new Date().toISOString();
    const ok = (
      granted: string[] | null,
      message = 'Working',
    ): AccountHealth => {
      const missing = missingPermissions(account.platform, granted);
      return {
        status: 'ok',
        message: missing.length
          ? 'Connected, but some features are missing permissions'
          : message,
        checkedAt: now,
        missing,
      };
    };
    const graph = (path: string, params: Record<string, string>) =>
      axios.get(`https://graph.facebook.com/${META_GRAPH_VERSION}/${path}`, {
        params,
        timeout: 10_000,
      });
    const metaGranted = async (userToken: string): Promise<string[] | null> => {
      if (!userToken) return null;
      const { data } = await graph('me/permissions', {
        access_token: userToken,
      });
      return (
        (data?.data ?? []) as Array<{ permission: string; status: string }>
      )
        .filter((p) => p.status === 'granted')
        .map((p) => p.permission);
    };
    const scopeList = (raw: unknown) =>
      typeof raw === 'string' && raw.trim()
        ? raw.split(/[\s,]+/).filter(Boolean)
        : null;

    switch (account.platform) {
      case 'facebook': {
        const pageId = (meta.page_id as string) || account.externalId;
        const pageToken = (meta.page_token as string) || token;
        if (pageId)
          await graph(pageId, { fields: 'id,name', access_token: pageToken });
        return ok(await metaGranted(token));
      }
      case 'instagram': {
        if (meta.login_type === 'instagram') {
          await axios.get(
            `https://graph.instagram.com/${META_GRAPH_VERSION}/me`,
            {
              params: { fields: 'user_id,username', access_token: token },
              timeout: 10_000,
            },
          );
          return {
            ...ok(null),
            missing: missingPermissions(
              'instagram_login',
              scopeList(meta.scope),
            ),
          };
        }
        const igId =
          (meta.instagram_business_account_id as string) || account.externalId;
        const pageToken = (meta.page_token as string) || token;
        if (igId)
          await graph(igId, { fields: 'id,username', access_token: pageToken });
        return ok(await metaGranted(token));
      }
      case 'whatsapp': {
        const phoneId = (meta.phone_number_id as string) || account.externalId;
        if (phoneId)
          await graph(phoneId, {
            fields: 'id,display_phone_number',
            access_token: token,
          });
        return ok(null);
      }
      case 'linkedin': {
        await axios.get('https://api.linkedin.com/v2/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10_000,
        });
        return ok(null);
      }
      case 'youtube':
      case 'google': {
        const { data } = await axios.get(
          'https://www.googleapis.com/oauth2/v3/tokeninfo',
          { params: { access_token: token }, timeout: 10_000 },
        );
        return ok(scopeList(data?.scope));
      }
      case 'tiktok': {
        await axios.post(
          'https://open.tiktokapis.com/v2/user/info/?fields=open_id',
          null,
          {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10_000,
          },
        );
        return ok(scopeList(meta.scope));
      }
      case 'threads': {
        await axios.get('https://graph.threads.net/v1.0/me', {
          params: { fields: 'id,username', access_token: token },
          timeout: 10_000,
        });
        return ok(scopeList(meta.scope));
      }
      case 'pinterest': {
        await axios.get('https://api.pinterest.com/v5/user_account', {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10_000,
        });
        if (meta.board_id) {
          await axios.get(
            `https://api.pinterest.com/v5/boards/${meta.board_id}`,
            { headers: { Authorization: `Bearer ${token}` }, timeout: 10_000 },
          );
        }
        return ok(scopeList(meta.scope));
      }
      case 'google_business': {
        const { data } = await axios.get(
          'https://www.googleapis.com/oauth2/v3/tokeninfo',
          { params: { access_token: token }, timeout: 10_000 },
        );
        return ok(scopeList(data?.scope));
      }
      case 'telegram': {
        await axios.post(
          `https://api.telegram.org/bot${token}/getChat`,
          { chat_id: meta.chat_id },
          { timeout: 10_000 },
        );
        return ok(null);
      }
      case 'twitter':
      case 'x': {
        if (meta.auth_type === 'oauth1') {
          return {
            status: 'unchecked',
            message:
              "Connected with saved credentials, which can't be checked automatically.",
            checkedAt: now,
            missing: [],
          };
        }
        await axios.get('https://api.twitter.com/2/users/me', {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10_000,
        });
        return ok(scopeList(meta.scope));
      }
      default:
        return {
          status: 'unchecked',
          message: "This channel can't be checked automatically yet.",
          checkedAt: now,
          missing: [],
        };
    }
  }
}
