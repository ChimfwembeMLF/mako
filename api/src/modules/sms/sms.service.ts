import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { PlatformIntegrationsService } from '../system_settings/services/platform-integrations.service';
import { maskNumber, normalizeZambianNumber } from './sms-number.util';

const DEFAULT_API_URL = 'https://sms-api.trinolux.com/v1';
const MAX_MESSAGE_LENGTH = 160;
const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 15000;

type TrinoluxResponse = {
  success?: boolean;
  message?: string;
  data?: {
    status?: string;
    sent?: number;
    failed?: number;
    message_ids?: number[];
    retry_after_seconds?: number;
  } | null;
};

export type SmsAccepted = {
  accepted: true;
  /** Queued or Sent means Trinolux took the message, not that it reached the phone. */
  status: string;
  messageIds: number[];
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly integrations: PlatformIntegrationsService) {}

  async isConfigured(): Promise<boolean> {
    const [apiKey, senderId] = await Promise.all([
      this.integrations.getIntegrationWithEnvFallback('TRINOLUX_API_KEY'),
      this.integrations.getIntegrationWithEnvFallback('TRINOLUX_SENDER_ID'),
    ]);
    return Boolean(apiKey && senderId);
  }

  /** Sends Mako's own messages using the platform account. */
  async send(params: {
    to: string;
    message: string;
    type?: 'SMS' | 'OTP';
  }): Promise<SmsAccepted> {
    const to = normalizeZambianNumber(params.to);
    if (!to) throw new BadRequestException('Enter a valid Zambian mobile number');

    const message = params.message.trim();
    if (!message) throw new BadRequestException('Enter a message');
    if (message.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(
        `Messages are limited to ${MAX_MESSAGE_LENGTH} characters`,
      );
    }

    const [apiKey, senderId, apiUrl] = await Promise.all([
      this.integrations.getIntegrationWithEnvFallback('TRINOLUX_API_KEY'),
      this.integrations.getIntegrationWithEnvFallback('TRINOLUX_SENDER_ID'),
      this.integrations.getIntegrationWithEnvFallback('TRINOLUX_API_URL'),
    ]);
    if (!apiKey || !senderId) {
      throw new ServiceUnavailableException(
        'SMS is not configured. Add the Trinolux API key and Sender ID.',
      );
    }

    // Kept across retries so a timed-out request can't text the recipient twice.
    const idempotencyKey = randomUUID();

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const response = await this.post(
        `${(apiUrl || DEFAULT_API_URL).replace(/\/$/, '')}/sms/send`,
        apiKey,
        idempotencyKey,
        {
          sender_id: senderId,
          to: [to],
          message,
          message_type: params.type ?? 'SMS',
        },
      );

      const accepted = this.acceptedResult(response);
      if (accepted) {
        this.logger.log(`SMS accepted for ${maskNumber(to)}: ${accepted.status}`);
        return accepted;
      }

      this.throwIfFinal(response);
      if (attempt < MAX_ATTEMPTS) await sleep(this.retryDelayMs(response, attempt));
    }

    this.logger.error(`SMS to ${maskNumber(to)} failed after ${MAX_ATTEMPTS} attempts`);
    throw new ServiceUnavailableException(
      'The SMS service is unavailable. Try again shortly.',
    );
  }

  /** Never logs the error object: it would include the API key header. */
  private async post(
    url: string,
    apiKey: string,
    idempotencyKey: string,
    body: Record<string, unknown>,
  ): Promise<{ status: number; data?: TrinoluxResponse }> {
    try {
      const { status, data } = await axios.post<TrinoluxResponse>(url, body, {
        headers: {
          'X-API-KEY': apiKey,
          'Idempotency-Key': idempotencyKey,
          'Content-Type': 'application/json',
        },
        timeout: REQUEST_TIMEOUT_MS,
        validateStatus: () => true,
      });
      return { status, data };
    } catch {
      return { status: 0 };
    }
  }

  private acceptedResult({
    status,
    data,
  }: {
    status: number;
    data?: TrinoluxResponse;
  }): SmsAccepted | null {
    const { success, data: details } = data ?? {};
    if ((status !== 201 && status !== 202) || success !== true) return null;
    if (details?.status === 'Partial' || (details?.failed ?? 0) > 0) return null;
    return {
      accepted: true,
      status: details?.status ?? 'Queued',
      messageIds: details?.message_ids ?? [],
    };
  }

  private throwIfFinal({
    status,
    data,
  }: {
    status: number;
    data?: TrinoluxResponse;
  }): void {
    if (status === 0 || status === 429 || status >= 500) return;

    if (status === 401 || status === 403) {
      this.logger.error(`Trinolux refused the API key (${status})`);
      throw new ServiceUnavailableException(
        'Trinolux refused the API key. Check the key and its SendSMS scope.',
      );
    }
    throw new BadRequestException(data?.message || 'Trinolux rejected this message');
  }

  private retryDelayMs(
    { status, data }: { status: number; data?: TrinoluxResponse },
    attempt: number,
  ): number {
    const wait = data?.data?.retry_after_seconds;
    if (status === 429 && typeof wait === 'number') return wait * 1000;
    return 2 ** (attempt - 1) * 1000;
  }
}
