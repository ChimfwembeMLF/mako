import { BadRequestException } from '@nestjs/common';

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

/** PawaPay wallets enabled on the merchant account. */
export const PAYMENT_COUNTRY_OPTIONS: PaymentCountryOption[] = [
  {
    id: 'BEN',
    countryCode: 'BEN',
    name: 'Benin',
    dialCode: '229',
    currency: 'XOF',
    providers: [
      { code: 'MOOV_BEN', label: 'Moov' },
      { code: 'MTN_MOMO_BEN', label: 'MTN' },
    ],
  },
  {
    id: 'CMR',
    countryCode: 'CMR',
    name: 'Cameroon',
    dialCode: '237',
    currency: 'XAF',
    providers: [
      { code: 'MTN_MOMO_CMR', label: 'MTN' },
      { code: 'ORANGE_CMR', label: 'Orange' },
    ],
  },
  {
    id: 'CIV',
    countryCode: 'CIV',
    name: "Côte d'Ivoire",
    dialCode: '225',
    currency: 'XOF',
    providers: [
      { code: 'MTN_MOMO_CIV', label: 'MTN' },
      { code: 'ORANGE_CIV', label: 'Orange' },
    ],
  },
  {
    id: 'COD-CDF',
    countryCode: 'COD',
    name: 'DR Congo (CDF)',
    dialCode: '243',
    currency: 'CDF',
    providers: [
      { code: 'AIRTEL_COD', label: 'Airtel' },
      { code: 'ORANGE_COD', label: 'Orange' },
      { code: 'VODACOM_MPESA_COD', label: 'Vodacom' },
    ],
  },
  {
    id: 'COD-USD',
    countryCode: 'COD',
    name: 'DR Congo (USD)',
    dialCode: '243',
    currency: 'USD',
    providers: [
      { code: 'AIRTEL_COD', label: 'Airtel' },
      { code: 'ORANGE_COD', label: 'Orange' },
      { code: 'VODACOM_MPESA_COD', label: 'Vodacom' },
    ],
  },
  {
    id: 'GAB',
    countryCode: 'GAB',
    name: 'Gabon',
    dialCode: '241',
    currency: 'XAF',
    providers: [{ code: 'AIRTEL_GAB', label: 'Airtel' }],
  },
  {
    id: 'KEN',
    countryCode: 'KEN',
    name: 'Kenya',
    dialCode: '254',
    currency: 'KES',
    providers: [{ code: 'MPESA_KEN', label: 'Safaricom M-Pesa' }],
  },
  {
    id: 'COG',
    countryCode: 'COG',
    name: 'Republic of the Congo',
    dialCode: '242',
    currency: 'XAF',
    providers: [
      { code: 'AIRTEL_COG', label: 'Airtel' },
      { code: 'MTN_MOMO_COG', label: 'MTN' },
    ],
  },
  {
    id: 'RWA',
    countryCode: 'RWA',
    name: 'Rwanda',
    dialCode: '250',
    currency: 'RWF',
    providers: [
      { code: 'AIRTEL_RWA', label: 'Airtel' },
      { code: 'MTN_MOMO_RWA', label: 'MTN' },
    ],
  },
  {
    id: 'SEN',
    countryCode: 'SEN',
    name: 'Senegal',
    dialCode: '221',
    currency: 'XOF',
    providers: [
      { code: 'FREE_SEN', label: 'Free' },
      { code: 'ORANGE_SEN', label: 'Orange' },
    ],
  },
  {
    id: 'SLE',
    countryCode: 'SLE',
    name: 'Sierra Leone',
    dialCode: '232',
    currency: 'SLE',
    providers: [{ code: 'ORANGE_SLE', label: 'Orange' }],
  },
  {
    id: 'UGA',
    countryCode: 'UGA',
    name: 'Uganda',
    dialCode: '256',
    currency: 'UGX',
    providers: [
      { code: 'AIRTEL_OAPI_UGA', label: 'Airtel' },
      { code: 'MTN_MOMO_UGA', label: 'MTN' },
    ],
  },
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

const PROVIDER_LABELS = Object.fromEntries(
  PAYMENT_COUNTRY_OPTIONS.flatMap((country) =>
    country.providers.map((provider) => [provider.code, provider.label]),
  ),
) as Record<string, string>;

export function listPaymentCountryOptions(): PaymentCountryOption[] {
  return PAYMENT_COUNTRY_OPTIONS;
}

export function findPaymentCountry(
  paymentCountryId?: string,
): PaymentCountryOption | undefined {
  if (!paymentCountryId?.trim()) return undefined;
  return PAYMENT_COUNTRY_OPTIONS.find((c) => c.id === paymentCountryId.trim());
}

export function formatPaymentProviderLabel(correspondent?: string | null): string {
  if (!correspondent) return 'Mobile Money';
  return PROVIDER_LABELS[correspondent] ?? correspondent;
}

export function normalizeMobileMoneyPhone(
  dialCode: string,
  raw?: string,
): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith(dialCode)) return digits;
  const local = digits.replace(/^0+/, '');
  return `${dialCode}${local}`;
}

export type ResolvedPaymentSelection = {
  paymentCountryId: string;
  countryCode: string;
  currency: string;
  correspondent: string;
  dialCode: string;
};

export function resolvePaymentSelection(input: {
  paymentCountryId?: string;
  correspondent?: string;
  currency?: string;
  countryCode?: string;
}): ResolvedPaymentSelection {
  const correspondent = input.correspondent?.trim();
  if (!correspondent) {
    throw new BadRequestException('Mobile money provider is required');
  }

  const explicitCountry = findPaymentCountry(input.paymentCountryId);
  if (explicitCountry) {
    const provider = explicitCountry.providers.find((p) => p.code === correspondent);
    if (!provider) {
      throw new BadRequestException(
        `Provider ${correspondent} is not available in ${explicitCountry.name}`,
      );
    }
    return {
      paymentCountryId: explicitCountry.id,
      countryCode: explicitCountry.countryCode,
      currency: explicitCountry.currency,
      correspondent: provider.code,
      dialCode: explicitCountry.dialCode,
    };
  }

  const matches = PAYMENT_COUNTRY_OPTIONS.filter((country) =>
    country.providers.some((p) => p.code === correspondent),
  );

  if (matches.length === 0) {
    throw new BadRequestException(`Unknown mobile money provider: ${correspondent}`);
  }

  let selected = matches[0];
  if (input.currency?.trim()) {
    const byCurrency = matches.filter((c) => c.currency === input.currency?.trim());
    if (byCurrency.length === 1) selected = byCurrency[0];
    else if (byCurrency.length > 1) selected = byCurrency[0];
  } else if (input.countryCode?.trim()) {
    const byCountry = matches.filter(
      (c) => c.countryCode === input.countryCode?.trim(),
    );
    if (byCountry.length === 1) selected = byCountry[0];
  }

  if (matches.length > 1 && !input.currency?.trim() && !input.paymentCountryId) {
    throw new BadRequestException(
      'paymentCountryId is required when the provider exists in multiple countries',
    );
  }

  return {
    paymentCountryId: selected.id,
    countryCode: selected.countryCode,
    currency: selected.currency,
    correspondent,
    dialCode: selected.dialCode,
  };
}
