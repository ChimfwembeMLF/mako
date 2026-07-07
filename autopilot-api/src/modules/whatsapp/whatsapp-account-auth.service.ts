import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { SocialAccountsService } from '../social_accounts/social_accounts.service';
import { WhatsappMessages } from './entities/whatsapp_messages.entity';
import {
  isPlatformManagedWhatsappAccount,
  WhatsappCredentials,
} from './whatsapp-platform.util';
import {
  WhatsappMessagingService,
  SendMessageResult,
} from './whatsapp-messaging.service';

@Injectable()
export class WhatsappAccountAuthService {
  constructor(
    private readonly socialAccounts: SocialAccountsService,
    private readonly messaging: WhatsappMessagingService,
    private readonly config: ConfigService,
    @InjectRepository(WhatsappMessages)
    private readonly messagesRepo: Repository<WhatsappMessages>,
  ) {}

  async credentialsForAccount(
    account: SocialAccounts,
  ): Promise<{ creds: WhatsappCredentials | null; account: SocialAccounts }> {
    let active = account;
    if (!isPlatformManagedWhatsappAccount(account.metadata)) {
      active = await this.socialAccounts.refreshAccessTokenIfNeeded(account);
    }
    return {
      account: active,
      creds: this.messaging.credentialsFromAccount(active),
    };
  }

  async sendSessionText(
    account: SocialAccounts,
    toPhone: string,
    body: string,
  ): Promise<SendMessageResult & { account: SocialAccounts }> {
    let { creds, account: active } = await this.credentialsForAccount(account);
    if (!creds) {
      return {
        success: false,
        error: 'WhatsApp not connected',
        account: active,
      };
    }

    const sessionError = await this.assertSessionWindow(
      active.tenantId,
      toPhone,
    );
    if (sessionError) {
      return { success: false, error: sessionError, account: active };
    }

    let result = await this.messaging.sendSessionText(creds, toPhone, body);

    if (!result.success && this.isAuthError(result.error)) {
      if (!isPlatformManagedWhatsappAccount(account.metadata)) {
        active = await this.socialAccounts.forceRefreshToken(active);
        creds = this.messaging.credentialsFromAccount(active);
        if (creds) {
          result = await this.messaging.sendSessionText(creds, toPhone, body);
        }
      }
    }

    if (!result.success && this.isAuthError(result.error)) {
      const platformManaged = isPlatformManagedWhatsappAccount(active.metadata);
      if (!platformManaged) {
        active = await this.socialAccounts.markDisconnectedAuth(
          active,
          result.error ?? 'WhatsApp authentication failed',
        );
      }
      return {
        ...result,
        error: platformManaged
          ? this.messaging.platformTokenErrorMessage(result.error)
          : this.messaging.oauthTokenErrorMessage(),
        account: active,
      };
    }

    return { ...result, account: active };
  }

  /** Proactive message outside the 24h session window — requires a Meta-approved template. */
  async sendTemplateText(
    account: SocialAccounts,
    toPhone: string,
    body: string,
    templateName?: string,
    templateLanguage?: string,
  ): Promise<
    SendMessageResult & { account: SocialAccounts; usedTemplate: true }
  > {
    const { creds, account: active } = await this.credentialsForAccount(
      account,
    );
    if (!creds) {
      return {
        success: false,
        error: 'WhatsApp not connected',
        account: active,
        usedTemplate: true,
      };
    }

    const name =
      templateName?.trim() ||
      this.config.get<string>('WHATSAPP_BROADCAST_TEMPLATE')?.trim() ||
      'hello_world';
    const language = templateLanguage?.trim() || 'en';

    let result = await this.messaging.sendTemplateText(
      creds,
      toPhone,
      body,
      name,
      language,
    );

    if (!result.success && this.isAuthError(result.error)) {
      if (!isPlatformManagedWhatsappAccount(active.metadata)) {
        const refreshed = await this.socialAccounts.forceRefreshToken(active);
        const refreshedCreds = this.messaging.credentialsFromAccount(refreshed);
        if (refreshedCreds) {
          result = await this.messaging.sendTemplateText(
            refreshedCreds,
            toPhone,
            body,
            name,
            language,
          );
        }
      }
    }

    return { ...result, account: active, usedTemplate: true };
  }

  async sendReply(
    account: SocialAccounts,
    toPhone: string,
    body: string,
    options?: {
      useTemplate?: boolean;
      templateName?: string;
      templateLanguage?: string;
    },
  ): Promise<
    SendMessageResult & { account: SocialAccounts; usedTemplate?: boolean }
  > {
    if (options?.useTemplate) {
      return this.sendTemplateText(
        account,
        toPhone,
        body,
        options.templateName,
        options.templateLanguage,
      );
    }
    return this.sendSessionText(account, toPhone, body);
  }

  private isAuthError(message?: string): boolean {
    if (!message) return false;
    return /#190\b|invalid oauth|session has expired|error validating access token/i.test(
      message,
    );
  }

  /** WhatsApp session messages only work within 24h of the customer's last inbound message. */
  private async assertSessionWindow(
    tenantId: string,
    toPhone: string,
  ): Promise<string | null> {
    const phone = this.messaging.normalizePhone(toPhone);
    const lastInbound = await this.messagesRepo.findOne({
      where: { tenantId, phone, direction: 'inbound' },
      order: { created_at: 'DESC' },
    });

    if (!lastInbound) {
      return (
        'This customer has not messaged your WhatsApp business number yet (no inbound message on record). ' +
        'They must message your business number first — then you can reply within 24 hours. ' +
        'If they already messaged you, configure the Meta webhook (messages field) so inbound DMs are received. ' +
        'To message them first, use an approved WhatsApp template.'
      );
    }

    const windowMs = 24 * 60 * 60 * 1000;
    if (Date.now() - lastInbound.created_at.getTime() > windowMs) {
      return (
        'The 24-hour WhatsApp reply window has expired. Ask the customer to message you again, ' +
        'or send an approved template message from Content Engine / broadcast.'
      );
    }

    return null;
  }
}
