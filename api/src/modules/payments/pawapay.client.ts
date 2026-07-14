import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { isAxiosError } from 'axios';

export type PawaPayDepositInput = {
  depositId: string;
  amount: string;
  currency: string;
  correspondent: string;
  phone?: string;
  customerMessage: string;
};

export type PawaPayRefundInput = {
  refundId: string;
  depositId: string;
  amount: string;
  currency: string;
};

const PAWAPAY_V2_SANDBOX = 'https://api.sandbox.pawapay.io/v2';
const PAWAPAY_V2_PROD = 'https://api.pawapay.io/v2';

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

/** Always resolve to a /v2 base URL (upgrades legacy /v1 env values). */
export function normalizePawaPayV2BaseUrl(url: string): string {
  let base = url.trim().replace(/\/$/, '');
  base = base.replace(/\/v1$/i, '/v2');
  if (!/\/v2$/i.test(base)) {
    base = `${base}/v2`;
  }
  return base;
}

export function resolvePawaPayBaseUrl(config: ConfigService): string {
  const isSandbox = config.get<string>('PAWAPAY_ENV') === 'sandbox';
  const raw = isSandbox
    ? firstNonEmpty(
        config.get<string>('PAWAPAY_BASE_URL_SANDBOX'),
        config.get<string>('PAWAPAY_SANDBOX_API_URL'),
      )
    : firstNonEmpty(
        config.get<string>('PAWAPAY_BASE_URL_PROD'),
        config.get<string>('PAWAPAY_API_URL'),
      );

  const fallback = isSandbox ? PAWAPAY_V2_SANDBOX : PAWAPAY_V2_PROD;
  return normalizePawaPayV2BaseUrl(raw || fallback);
}

function truncateCustomerMessage(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 22) return trimmed;
  return trimmed.slice(0, 22);
}

export function buildPawaPayDepositPayload(input: PawaPayDepositInput) {
  return {
    depositId: input.depositId,
    amount: input.amount,
    currency: input.currency,
    payer: {
      type: 'MMO',
      accountDetails: {
        provider: input.correspondent,
        phoneNumber: input.phone,
      },
    },
    customerMessage: truncateCustomerMessage(input.customerMessage),
  };
}

export function buildPawaPayRefundPayload(input: PawaPayRefundInput) {
  return {
    refundId: input.refundId,
    depositId: input.depositId,
    amount: input.amount,
    currency: input.currency,
  };
}

export function formatPawaPayError(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as
      | { errorMessage?: string; message?: string }
      | undefined;
    const detail = data?.errorMessage || data?.message;
    if (detail) return detail;
    if (error.response?.status) {
      return `Payment gateway returned ${error.response.status}`;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : 'Unknown payment gateway error';
}

function pawaPayAuthHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function postPawaPayDeposit(
  config: ConfigService,
  input: PawaPayDepositInput,
): Promise<void> {
  const token = config.get<string>('PAWAPAY_API_TOKEN')?.trim();
  if (!token) return;

  const baseUrl = resolvePawaPayBaseUrl(config);
  const payload = buildPawaPayDepositPayload(input);

  try {
    await axios.post(`${baseUrl}/deposits`, payload, {
      headers: pawaPayAuthHeaders(token),
    });
  } catch (error) {
    throw new BadRequestException(formatPawaPayError(error));
  }
}

export async function postPawaPayRefund(
  config: ConfigService,
  input: PawaPayRefundInput,
): Promise<void> {
  const token = config.get<string>('PAWAPAY_API_TOKEN')?.trim();
  if (!token) {
    throw new BadRequestException('PAWAPAY_API_TOKEN is not configured');
  }

  const baseUrl = resolvePawaPayBaseUrl(config);
  const payload = buildPawaPayRefundPayload(input);

  try {
    await axios.post(`${baseUrl}/refunds`, payload, {
      headers: pawaPayAuthHeaders(token),
    });
  } catch (error) {
    throw new BadRequestException(formatPawaPayError(error));
  }
}

export async function getPawaPayDepositStatus(
  config: ConfigService,
  depositId: string,
): Promise<unknown> {
  const token = config.get<string>('PAWAPAY_API_TOKEN')?.trim();
  if (!token) return null;

  const baseUrl = resolvePawaPayBaseUrl(config);
  const response = await axios.get(`${baseUrl}/deposits/${depositId}`, {
    headers: pawaPayAuthHeaders(token),
  });
  return response.data;
}
