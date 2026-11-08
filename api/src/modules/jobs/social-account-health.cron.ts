import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import {
  AccountHealth,
  SocialAccountHealthService,
} from '../social_accounts/social-account-health.service';
import { NotificationsService } from '../notifications/notifications.service';

export type HealthAlert = {
  title: string;
  body: string;
  markExpiryWarned?: string;
};

const PLATFORM_NAMES: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  google: 'Google',
  tiktok: 'TikTok',
  twitter: 'X',
  x: 'X',
  whatsapp: 'WhatsApp',
};

/**
 * What to tell the organization after a nightly check, if anything: access that has
 * just been lost (not every night it stays lost), and access that ends within a week
 * (once per expiry date).
 */
export function healthAlert(
  account: Pick<
    SocialAccounts,
    'platform' | 'accountName' | 'expiresAt' | 'metadata'
  >,
  before: AccountHealth | undefined,
  after: AccountHealth,
  now = new Date(),
): HealthAlert | null {
  const name = `${PLATFORM_NAMES[account.platform] ?? account.platform} (${
    account.accountName || 'account'
  })`;
  if (after.status === 'revoked' && before?.status !== 'revoked') {
    return {
      title: `${name} needs reconnecting`,
      body: 'Mako can no longer post to this account. Reconnect it on the Social accounts page so scheduled posts go out.',
    };
  }
  if (account.expiresAt) {
    const expires = new Date(account.expiresAt);
    const days = Math.ceil((expires.getTime() - now.getTime()) / 86_400_000);
    const iso = expires.toISOString();
    if (days >= 0 && days <= 7 && account.metadata?.expiry_warned_for !== iso) {
      return {
        title: `${name} access ends ${
          days <= 1 ? 'tomorrow' : `in ${days} days`
        }`,
        body: 'Reconnect it on the Social accounts page before then to keep posting without interruption.',
        markExpiryWarned: iso,
      };
    }
  }
  return null;
}

@Injectable()
export class SocialAccountHealthCron {
  private readonly logger = new Logger(SocialAccountHealthCron.name);

  constructor(
    @InjectRepository(SocialAccounts)
    private readonly repo: Repository<SocialAccounts>,
    private readonly health: SocialAccountHealthService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  @Cron('0 0 3 * * *')
  async handleCron() {
    if (this.config.get<string>('SOCIAL_HEALTH_CRON_ENABLED') === 'false')
      return;
    const accounts = await this.repo.find({ where: { connected: true } });
    let alerts = 0;
    for (const account of accounts) {
      try {
        const before = account.metadata?.health as AccountHealth | undefined;
        const after = await this.health.check(account);
        const alert = healthAlert(account, before, after);
        if (!alert) continue;
        await this.notifications.notifyTenantAdmins(account.tenantId, {
          type: 'social_account_attention',
          title: alert.title,
          body: alert.body,
          link: '/publisher',
          metadata: { socialAccountId: account.id, platform: account.platform },
          email: true,
        });
        if (alert.markExpiryWarned) {
          account.metadata = {
            ...(account.metadata ?? {}),
            expiry_warned_for: alert.markExpiryWarned,
          };
          await this.repo.save(account);
        }
        alerts++;
      } catch (err) {
        this.logger.warn(
          `Health check for ${account.platform} ${account.id} failed: ${
            (err as Error)?.message
          }`,
        );
      }
    }
    if (alerts)
      this.logger.log(
        `Social account health: ${accounts.length} checked, ${alerts} alerts sent`,
      );
  }
}
