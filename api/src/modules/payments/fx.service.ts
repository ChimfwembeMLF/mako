import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const BASE_CURRENCY = 'ZMW';
/** Free FX feed — no API key required (https://open.er-api.com). */
const DEFAULT_RATES_URL = 'https://open.er-api.com/v6/latest/ZMW';
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000;

/** Currencies charged as whole units on mobile money rails. */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'XOF',
  'XAF',
  'KES',
  'RWF',
  'UGX',
  'SLE',
  'CDF',
]);

/** Fallback rates: 1 ZMW = rate units of target currency. */
const FALLBACK_RATES_FROM_ZMW: Record<string, number> = {
  ZMW: 1,
  KES: 7.16,
  XOF: 31.84,
  XAF: 31.84,
  CDF: 127.32,
  USD: 0.0554,
  RWF: 81.48,
  SLE: 1.32,
  UGX: 203.74,
};

export type FxQuote = {
  amountZmw: number;
  currency: string;
  amount: string;
  rate: number;
  asOf: string;
  source: 'live' | 'fallback';
};

export type FxToZmwQuote = {
  amount: number;
  currency: string;
  amountZmw: string;
  rate: number;
  asOf: string;
  source: 'live' | 'fallback';
};

type RatesCache = {
  rates: Record<string, number>;
  asOf: string;
  source: 'live' | 'fallback';
  fetchedAt: number;
};

@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);
  private cache: RatesCache | null = null;

  constructor(private readonly config: ConfigService) {}

  async quoteFromZmw(amountZmw: number, currency: string): Promise<FxQuote> {
    const normalizedCurrency = this.normalizeCurrency(currency);
    const normalizedAmountZmw = this.normalizePositive(amountZmw, 'amountZmw');

    if (normalizedCurrency === BASE_CURRENCY) {
      const amount = this.formatChargeAmount(normalizedAmountZmw, BASE_CURRENCY);
      return {
        amountZmw: normalizedAmountZmw,
        currency: BASE_CURRENCY,
        amount,
        rate: 1,
        asOf: new Date().toISOString(),
        source: 'fallback',
      };
    }

    const { rates, asOf, source } = await this.getRates();
    const rate = rates[normalizedCurrency];
    if (!rate) {
      throw new BadRequestException(`FX rate unavailable for ${normalizedCurrency}`);
    }

    const converted = normalizedAmountZmw * rate;
    return {
      amountZmw: normalizedAmountZmw,
      currency: normalizedCurrency,
      amount: this.formatChargeAmount(converted, normalizedCurrency),
      rate,
      asOf,
      source,
    };
  }

  async quoteToZmw(amount: number, currency: string): Promise<FxToZmwQuote> {
    const normalizedCurrency = this.normalizeCurrency(currency);
    const normalizedAmount = this.normalizePositive(amount, 'amount');

    if (normalizedCurrency === BASE_CURRENCY) {
      return {
        amount: normalizedAmount,
        currency: BASE_CURRENCY,
        amountZmw: this.formatZmwAmount(normalizedAmount),
        rate: 1,
        asOf: new Date().toISOString(),
        source: 'fallback',
      };
    }

    const { rates, asOf, source } = await this.getRates();
    const rate = rates[normalizedCurrency];
    if (!rate) {
      throw new BadRequestException(`FX rate unavailable for ${normalizedCurrency}`);
    }

    const amountZmw = normalizedAmount / rate;
    return {
      amount: normalizedAmount,
      currency: normalizedCurrency,
      amountZmw: this.formatZmwAmount(amountZmw),
      rate,
      asOf,
      source,
    };
  }

  formatChargeAmount(amount: number, currency: string): string {
    const code = this.normalizeCurrency(currency);
    if (ZERO_DECIMAL_CURRENCIES.has(code)) {
      return String(Math.ceil(amount));
    }
    if (code === 'USD' || code === 'ZMW') {
      return (Math.ceil(amount * 100) / 100).toFixed(2);
    }
    return String(Math.ceil(amount));
  }

  formatZmwAmount(amount: number): string {
    return (Math.round(amount * 100) / 100).toFixed(2);
  }

  private normalizeCurrency(currency: string): string {
    const code = currency?.trim().toUpperCase();
    if (!code) {
      throw new BadRequestException('currency is required');
    }
    return code;
  }

  private normalizePositive(value: number, field: string): number {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      throw new BadRequestException(`${field} must be a positive number`);
    }
    return n;
  }

  private async getRates(): Promise<RatesCache> {
    const ttl = Number(this.config.get<string>('FX_CACHE_TTL_MS')) || DEFAULT_CACHE_TTL_MS;
    if (this.cache && Date.now() - this.cache.fetchedAt < ttl) {
      return this.cache;
    }

    const url =
      this.config.get<string>('FX_RATES_URL')?.trim() || DEFAULT_RATES_URL;

    try {
      const response = await axios.get(url, { timeout: 10_000 });
      const data = response.data as {
        result?: string;
        rates?: Record<string, number>;
        time_last_update_utc?: string;
      };

      if (data.result !== 'success' || !data.rates) {
        throw new Error('FX API returned an invalid payload');
      }

      this.cache = {
        rates: { ...FALLBACK_RATES_FROM_ZMW, ...data.rates },
        asOf: data.time_last_update_utc ?? new Date().toISOString(),
        source: 'live',
        fetchedAt: Date.now(),
      };
      return this.cache;
    } catch (error) {
      this.logger.warn(
        `FX live rates unavailable, using fallback (${error instanceof Error ? error.message : error})`,
      );
      this.cache = {
        rates: { ...FALLBACK_RATES_FROM_ZMW },
        asOf: new Date().toISOString(),
        source: 'fallback',
        fetchedAt: Date.now(),
      };
      return this.cache;
    }
  }
}
