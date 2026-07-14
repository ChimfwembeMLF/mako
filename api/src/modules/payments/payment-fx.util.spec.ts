import {
  buildPaymentFxPayload,
  parsePaymentFxMeta,
  resolveAdsCreditZmw,
} from './payment-fx.util';

describe('payment-fx.util', () => {
  it('round-trips FX metadata in raw payload', () => {
    const raw = buildPaymentFxPayload({
      amountZmw: '375.00',
      fxRate: '7.16',
      fxSource: 'live',
    });
    const meta = parsePaymentFxMeta(raw);
    expect(meta.amountZmw).toBe('375.00');
    expect(meta.fxRate).toBe('7.16');
    expect(meta.fxSource).toBe('live');
  });

  it('resolves ads credit from stored ZMW amount', () => {
    const raw = buildPaymentFxPayload({ amountZmw: '69.85' });
    expect(resolveAdsCreditZmw('3580', 'KES', raw)).toBe(69.85);
  });

  it('falls back to deposit amount when currency is ZMW', () => {
    expect(resolveAdsCreditZmw('500', 'ZMW', null)).toBe(500);
  });
});
