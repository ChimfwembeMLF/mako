import { useEffect, useState } from 'react';
import { paymentsApi } from '@/lib/api';

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

export function useFxQuoteFromZmw(amountZmw: number | null | undefined, currency: string) {
  const [quote, setQuote] = useState<FxQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!amountZmw || amountZmw <= 0 || !currency) {
      setQuote(null);
      setError(null);
      return;
    }

    if (currency === 'ZMW') {
      setQuote({
        amountZmw,
        currency: 'ZMW',
        amount: amountZmw.toFixed(2),
        rate: 1,
        asOf: new Date().toISOString(),
        source: 'fallback',
      });
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    paymentsApi
      .fxQuoteFromZmw(amountZmw, currency)
      .then((result) => {
        if (!cancelled) setQuote(result);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setQuote(null);
          setError(e instanceof Error ? e.message : 'Could not load FX quote');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [amountZmw, currency]);

  return { quote, loading, error };
}

export function useFxQuoteToZmw(amount: number | null | undefined, currency: string) {
  const [quote, setQuote] = useState<FxToZmwQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!amount || amount <= 0 || !currency) {
      setQuote(null);
      setError(null);
      return;
    }

    if (currency === 'ZMW') {
      setQuote({
        amount,
        currency: 'ZMW',
        amountZmw: amount.toFixed(2),
        rate: 1,
        asOf: new Date().toISOString(),
        source: 'fallback',
      });
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    paymentsApi
      .fxQuoteToZmw(amount, currency)
      .then((result) => {
        if (!cancelled) setQuote(result);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setQuote(null);
          setError(e instanceof Error ? e.message : 'Could not load FX quote');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [amount, currency]);

  return { quote, loading, error };
}
