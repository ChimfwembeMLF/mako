import React, { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { paymentsApi } from '@/lib/api';
import {
  buildPaymentPhone,
  defaultPaymentCountryId,
  type MobileMoneyPaymentValue,
  type PaymentCountryOption,
} from '@/lib/payment-countries';

export type { MobileMoneyPaymentValue };

type MobileMoneyPaymentFormProps = {
  value: MobileMoneyPaymentValue;
  onChange: (value: MobileMoneyPaymentValue) => void;
  disabled?: boolean;
};

export function MobileMoneyPaymentForm({
  value,
  onChange,
  disabled = false,
}: MobileMoneyPaymentFormProps) {
  const [countries, setCountries] = useState<PaymentCountryOption[]>([]);

  useEffect(() => {
    paymentsApi
      .mobileMoneyOptions()
      .then(setCountries)
      .catch(() => setCountries([]));
  }, []);

  const selectedCountry = useMemo(
    () => countries.find((c) => c.id === value.paymentCountryId) ?? countries[0],
    [countries, value.paymentCountryId],
  );

  useEffect(() => {
    if (!countries.length) return;
    const exists = countries.some((c) => c.id === value.paymentCountryId);
    if (exists) return;
    const fallback = countries.find((c) => c.id === defaultPaymentCountryId) ?? countries[0];
    onChange({
      paymentCountryId: fallback.id,
      countryCode: fallback.countryCode,
      currency: fallback.currency,
      dialCode: fallback.dialCode,
      correspondent: fallback.providers[0]?.code ?? '',
      phone: '',
    });
  }, [countries, value.paymentCountryId, onChange]);

  function setCountry(countryId: string) {
    const country = countries.find((c) => c.id === countryId);
    if (!country) return;
    onChange({
      ...value,
      paymentCountryId: country.id,
      countryCode: country.countryCode,
      currency: country.currency,
      dialCode: country.dialCode,
      correspondent: country.providers[0]?.code ?? value.correspondent,
      phone: buildPaymentPhone(country.dialCode, value.phone),
    });
  }

  function setProvider(correspondent: string) {
    onChange({ ...value, correspondent });
  }

  function setPhoneLocal(local: string) {
    if (!selectedCountry) return;
    onChange({
      ...value,
      phone: buildPaymentPhone(selectedCountry.dialCode, local),
    });
  }

  const localPhone = value.phone.startsWith(value.dialCode)
    ? value.phone.slice(value.dialCode.length)
    : value.phone;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Country</Label>
        <Select
          value={value.paymentCountryId}
          onValueChange={setCountry}
          disabled={disabled || countries.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select country" />
          </SelectTrigger>
          <SelectContent>
            {countries.map((country) => (
              <SelectItem key={country.id} value={country.id}>
                {country.name} ({country.currency}) · +{country.dialCode}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Mobile network</Label>
        <Select
          value={value.correspondent}
          onValueChange={setProvider}
          disabled={disabled || !selectedCountry}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select network" />
          </SelectTrigger>
          <SelectContent>
            {(selectedCountry?.providers ?? []).map((provider) => (
              <SelectItem key={provider.code} value={provider.code}>
                {provider.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Phone number</Label>
        <div className="flex rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring">
          <span className="inline-flex items-center px-3 text-sm text-muted-foreground border-r bg-muted/40 shrink-0">
            +{value.dialCode || selectedCountry?.dialCode || '…'}
          </span>
          <Input
            type="tel"
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder="e.g. 971234567"
            value={localPhone}
            onChange={(e) => setPhoneLocal(e.target.value)}
            disabled={disabled}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Enter your mobile number without the country code. We send{' '}
          <span className="font-medium">+{value.dialCode}{localPhone || '…'}</span> to the payment
          provider.
        </p>
      </div>
    </div>
  );
}
