import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  getWhatsappPlatformCredentials,
  isPlatformManagedWhatsappAccount,
  WhatsappCredentials,
} from './whatsapp-platform.util';

export type { WhatsappCredentials } from './whatsapp-platform.util';

export type SendMessageResult = {
  success: boolean;
  waMessageId?: string;
  error?: string;
};

@Injectable()
export class WhatsappMessagingService {
  private readonly logger = new Logger(WhatsappMessagingService.name);
  private readonly graphVersion = 'v19.0';

  constructor(private readonly config: ConfigService) {}

  normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  async sendSessionText(
    creds: WhatsappCredentials,
    toPhone: string,
    body: string,
  ): Promise<SendMessageResult> {
    const to = this.normalizePhone(toPhone);
    const text = body.trim().slice(0, 4096);
    if (!text) return { success: false, error: 'Empty message body' };

    try {
      const { data } = await axios.post<{ messages?: Array<{ id: string }> }>(
        `https://graph.facebook.com/${this.graphVersion}/${creds.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { preview_url: false, body: text },
        },
        { headers: { Authorization: `Bearer ${creds.accessToken}` } },
      );
      return { success: true, waMessageId: data.messages?.[0]?.id };
    } catch (err: unknown) {
      const message = this.formatGraphError(err);
      this.logger.warn(`WhatsApp session send failed → ${to}: ${message}`);
      return { success: false, error: message };
    }
  }

  /** Reply buttons (max 3) — within 24h session window. */
  async sendInteractiveButtons(
    creds: WhatsappCredentials,
    toPhone: string,
    body: string,
    buttons: Array<{ id: string; title: string }>,
  ): Promise<SendMessageResult> {
    const to = this.normalizePhone(toPhone);
    const trimmed = buttons.slice(0, 3).map((b) => ({
      type: 'reply' as const,
      reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) },
    }));

    if (!trimmed.length) {
      return this.sendSessionText(creds, toPhone, body);
    }

    try {
      const { data } = await axios.post<{ messages?: Array<{ id: string }> }>(
        `https://graph.facebook.com/${this.graphVersion}/${creds.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: body.trim().slice(0, 1024) },
            action: { buttons: trimmed },
          },
        },
        { headers: { Authorization: `Bearer ${creds.accessToken}` } },
      );
      return { success: true, waMessageId: data.messages?.[0]?.id };
    } catch (err: unknown) {
      const message = this.formatGraphError(err);
      this.logger.warn(`WhatsApp buttons send failed → ${to}: ${message}`);
      return { success: false, error: message };
    }
  }

  /** List message — within 24h session window. */
  async sendInteractiveList(
    creds: WhatsappCredentials,
    toPhone: string,
    body: string,
    buttonLabel: string,
    sections: Array<{
      title?: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>,
  ): Promise<SendMessageResult> {
    const to = this.normalizePhone(toPhone);

    try {
      const { data } = await axios.post<{ messages?: Array<{ id: string }> }>(
        `https://graph.facebook.com/${this.graphVersion}/${creds.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'interactive',
          interactive: {
            type: 'list',
            body: { text: body.trim().slice(0, 1024) },
            action: {
              button: buttonLabel.slice(0, 20),
              sections: sections.slice(0, 10).map((section) => ({
                title: section.title?.slice(0, 24),
                rows: section.rows.slice(0, 10).map((row) => ({
                  id: row.id.slice(0, 200),
                  title: row.title.slice(0, 24),
                  description: row.description?.slice(0, 72),
                })),
              })),
            },
          },
        },
        { headers: { Authorization: `Bearer ${creds.accessToken}` } },
      );
      return { success: true, waMessageId: data.messages?.[0]?.id };
    } catch (err: unknown) {
      const message = this.formatGraphError(err);
      this.logger.warn(`WhatsApp list send failed → ${to}: ${message}`);
      return { success: false, error: message };
    }
  }

  /** Proactive broadcast outside 24h window — requires Meta-approved template. */
  async sendTemplateText(
    creds: WhatsappCredentials,
    toPhone: string,
    body: string,
    templateName?: string,
    languageCode = 'en',
  ): Promise<SendMessageResult> {
    const name =
      templateName?.trim() ||
      this.config.get<string>('WHATSAPP_BROADCAST_TEMPLATE')?.trim() ||
      'hello_world';

    const to = this.normalizePhone(toPhone);
    const text = body.trim().slice(0, 1024);

    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name,
        language: { code: languageCode },
      },
    };

    if (name !== 'hello_world' && text) {
      (payload.template as Record<string, unknown>).components = [
        {
          type: 'body',
          parameters: [{ type: 'text', text }],
        },
      ];
    }

    try {
      const { data } = await axios.post<{ messages?: Array<{ id: string }> }>(
        `https://graph.facebook.com/${this.graphVersion}/${creds.phoneNumberId}/messages`,
        payload,
        { headers: { Authorization: `Bearer ${creds.accessToken}` } },
      );
      return { success: true, waMessageId: data.messages?.[0]?.id };
    } catch (err: unknown) {
      const message = this.formatGraphError(err);
      this.logger.warn(`WhatsApp template send failed → ${to}: ${message}`);
      return { success: false, error: message };
    }
  }

  async listMessageTemplates(
    creds: WhatsappCredentials,
  ): Promise<
    Array<{ name: string; language: string; status: string; category?: string }>
  > {
    try {
      const { data: phoneData } = await axios.get<{
        whatsapp_business_account?: { id?: string };
      }>(
        `https://graph.facebook.com/${this.graphVersion}/${creds.phoneNumberId}`,
        {
          params: {
            fields: 'whatsapp_business_account',
            access_token: creds.accessToken,
          },
        },
      );

      const wabaId = phoneData.whatsapp_business_account?.id;
      if (!wabaId) return [];

      const { data } = await axios.get<{
        data?: Array<{
          name?: string;
          language?: string;
          status?: string;
          category?: string;
        }>;
      }>(
        `https://graph.facebook.com/${this.graphVersion}/${wabaId}/message_templates`,
        {
          params: {
            access_token: creds.accessToken,
            limit: 100,
            fields: 'name,language,status,category',
          },
        },
      );

      return (data.data ?? [])
        .filter((t) => t.name && t.status === 'APPROVED')
        .map((t) => ({
          name: t.name!,
          language: t.language ?? 'en',
          status: t.status ?? 'APPROVED',
          category: t.category,
        }));
    } catch (err) {
      this.logger.warn(
        `Failed to list WhatsApp templates: ${
          err instanceof Error ? err.message : err
        }`,
      );
      return [];
    }
  }

  credentialsFromAccount(account: {
    accessToken?: string;
    metadata?: Record<string, unknown>;
  }): WhatsappCredentials | null {
    if (isPlatformManagedWhatsappAccount(account.metadata)) {
      return getWhatsappPlatformCredentials(this.config);
    }

    const phoneNumberId =
      typeof account.metadata?.phone_number_id === 'string'
        ? account.metadata.phone_number_id.trim()
        : '';
    const accessToken = account.accessToken?.trim();
    if (!phoneNumberId || !accessToken) return null;
    return { phoneNumberId, accessToken };
  }

  getPlatformCredentials(): WhatsappCredentials | null {
    return getWhatsappPlatformCredentials(this.config);
  }

  async validateCredentials(
    creds: WhatsappCredentials,
  ): Promise<{ valid: boolean; displayPhoneNumber?: string; error?: string }> {
    try {
      const { data } = await axios.get<{
        id?: string;
        display_phone_number?: string;
      }>(
        `https://graph.facebook.com/${this.graphVersion}/${creds.phoneNumberId}`,
        {
          params: {
            fields: 'id,display_phone_number',
            access_token: creds.accessToken,
          },
        },
      );
      return { valid: true, displayPhoneNumber: data.display_phone_number };
    } catch (err: unknown) {
      return { valid: false, error: this.formatGraphError(err) };
    }
  }

  platformTokenErrorMessage(graphError?: string): string {
    const expired =
      graphError &&
      /#190\b|session has expired|error validating access token/i.test(
        graphError,
      );
    if (expired) {
      return (
        'Platform WhatsApp access token expired. Update WHATSAPP_PLATFORM_ACCESS_TOKEN in the ' +
        'server environment with a new System User token from Meta Business Settings, then restart the API.'
      );
    }
    return (
      'Platform WhatsApp credentials are invalid. Verify WHATSAPP_PLATFORM_PHONE_NUMBER_ID and ' +
      'WHATSAPP_PLATFORM_ACCESS_TOKEN on the server, then restart the API.'
    );
  }

  oauthTokenErrorMessage(): string {
    return 'WhatsApp session expired. Reconnect WhatsApp in Publisher Connect, then try again.';
  }

  /** Map Meta Graph/WhatsApp errors to actionable messages for the UI. */
  humanizeSendError(message?: string): string {
    if (!message?.trim()) return 'WhatsApp send failed';
    if (/131030|not in allowed list/i.test(message)) {
      return (
        'This phone number is not on your WhatsApp test allow list. In Meta Developer Console → ' +
        'WhatsApp → API Setup, add the recipient under "Send messages to" (or complete Meta Business ' +
        'verification to message any customer in production).'
      );
    }
    if (/131026|message undeliverable/i.test(message)) {
      return 'WhatsApp could not deliver to this number — confirm it is registered on WhatsApp and uses the correct country code.';
    }
    if (/131047|24.?hour|session/i.test(message)) {
      return 'Outside the 24-hour messaging window. The customer must message you first, or send an approved template message.';
    }
    if (this.isAuthError(message)) {
      return this.oauthTokenErrorMessage();
    }
    return message;
  }

  private isAuthError(message: string): boolean {
    return /#190\b|invalid oauth|session has expired|error validating access token/i.test(
      message,
    );
  }

  private formatGraphError(err: unknown): string {
    if (axios.isAxiosError(err)) {
      const data = err.response?.data as {
        error?: { message?: string; code?: number };
      };
      if (data?.error?.message) {
        return `#${data.error.code ?? '?'} ${data.error.message}`;
      }
      return err.message;
    }
    return err instanceof Error ? err.message : String(err);
  }
}
