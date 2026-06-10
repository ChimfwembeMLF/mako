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

  async listMessageTemplates(creds: WhatsappCredentials): Promise<
    Array<{ name: string; language: string; status: string; category?: string }>
  > {
    try {
      const { data: phoneData } = await axios.get<{
        whatsapp_business_account?: { id?: string };
      }>(`https://graph.facebook.com/${this.graphVersion}/${creds.phoneNumberId}`, {
        params: {
          fields: 'whatsapp_business_account',
          access_token: creds.accessToken,
        },
      });

      const wabaId = phoneData.whatsapp_business_account?.id;
      if (!wabaId) return [];

      const { data } = await axios.get<{
        data?: Array<{
          name?: string;
          language?: string;
          status?: string;
          category?: string;
        }>;
      }>(`https://graph.facebook.com/${this.graphVersion}/${wabaId}/message_templates`, {
        params: {
          access_token: creds.accessToken,
          limit: 100,
          fields: 'name,language,status,category',
        },
      });

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
        `Failed to list WhatsApp templates: ${err instanceof Error ? err.message : err}`,
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

  private formatGraphError(err: unknown): string {
    if (axios.isAxiosError(err)) {
      const data = err.response?.data as { error?: { message?: string; code?: number } };
      if (data?.error?.message) {
        return `#${data.error.code ?? '?'} ${data.error.message}`;
      }
      return err.message;
    }
    return err instanceof Error ? err.message : String(err);
  }
}
