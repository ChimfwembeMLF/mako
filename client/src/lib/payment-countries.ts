export type PaymentProviderOption = {
  code: string;
  label: string;
};

export type PaymentCountryOption = {
  id: string;
  countryCode: string;
  name: string;
  dialCode: string;
  currency: string;
  providers: PaymentProviderOption[];
};

export const defaultPaymentCountryId = 'ZMB';

/** Fallback when API options are unavailable (kept in sync with server). */
export const FALLBACK_PAYMENT_COUNTRIES: PaymentCountryOption[] = [
  {
    id: 'ZMB',
    countryCode: 'ZMB',
    name: 'Zambia',
    dialCode: '260',
    currency: 'ZMW',
    providers: [
      { code: 'AIRTEL_OAPI_ZMB', label: 'Airtel' },
      { code: 'MTN_MOMO_ZMB', label: 'MTN' },
      { code: 'ZAMTEL_ZMB', label: 'Zamtel' },
    ],
  },
];

export function buildPaymentPhone(dialCode: string, raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith(dialCode)) return digits;
  const local = digits.replace(/^0+/, '');
  return `${dialCode}${local}`;
}

export function providerLabel(
  countries: PaymentCountryOption[],
  correspondent?: string | null,
): string {
  if (!correspondent) return 'Mobile Money';
  for (const country of countries) {
    const match = country.providers.find((p) => p.code === correspondent);
    if (match) return `${match.label} (${country.name})`;
  }
  return correspondent;
}

export function formatMoneyAmount(amount: string | number | null | undefined, currency: string) {
  const value = Number(amount ?? 0);
  if (!Number.isFinite(value)) return `— ${currency}`;
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
}

export type MobileMoneyPaymentValue = {
  paymentCountryId: string;
  correspondent: string;
  currency: string;
  countryCode: string;
  dialCode: string;
  phone: string;
};

export function createDefaultMobileMoneyPayment(): MobileMoneyPaymentValue {
  const zambia = FALLBACK_PAYMENT_COUNTRIES[0];
  return {
    paymentCountryId: zambia.id,
    countryCode: zambia.countryCode,
    currency: zambia.currency,
    dialCode: zambia.dialCode,
    correspondent: zambia.providers.find((p) => p.code === 'MTN_MOMO_ZMB')?.code ?? zambia.providers[0].code,
    phone: '',
  };
}
