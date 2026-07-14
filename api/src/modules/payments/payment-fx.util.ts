export type PaymentFxMeta = {
  paymentCountryId?: string;
  countryCode?: string;
  amountZmw?: string;
  fxRate?: string;
  fxAsOf?: string;
  fxSource?: string;
};

export function parsePaymentFxMeta(rawPayload?: string | null): PaymentFxMeta {
  if (!rawPayload?.trim()) return {};
  try {
    const parsed = JSON.parse(rawPayload) as PaymentFxMeta;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function buildPaymentFxPayload(meta: PaymentFxMeta): string {
  return JSON.stringify(meta);
}

export function resolveAdsCreditZmw(
  depositAmount: string | null | undefined,
  depositCurrency: string | null | undefined,
  rawPayload?: string | null,
): number {
  const meta = parsePaymentFxMeta(rawPayload);
  const stored = Number(meta.amountZmw);
  if (Number.isFinite(stored) && stored > 0) {
    return stored;
  }

  const amount = Number(depositAmount);
  if (!Number.isFinite(amount) || amount <= 0) return 0;

  const currency = (depositCurrency ?? 'ZMW').toUpperCase();
  if (currency === 'ZMW') return amount;

  return 0;
}
