import {
  buildSubscriptionReport,
  monthlyRecurringRevenue,
} from './subscription-report.util';

const now = new Date('2026-11-01T00:00:00Z');
const days = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);
const priceOf = (plan: string) => ({ free: 0, starter: 100, pro: 300 }[plan] ?? 0);

const tenant = (id: string) => ({ id, name: id, owner: { email: `${id}@x.co` } });
const sub = (tenantId: string, plan: string, status: string, end: Date) => ({
  tenantId,
  plan,
  status,
  billingPeriodEnd: end,
  autoRenewEnabled: false,
  renewalAttempts: 0,
  lastRenewalAttemptAt: undefined,
});

describe('monthlyRecurringRevenue', () => {
  it('counts active subscriptions only', () => {
    expect(
      monthlyRecurringRevenue(
        [
          { plan: 'pro', status: 'active' },
          { plan: 'pro', status: 'past_due' },
          { plan: 'starter', status: 'cancelled' },
          { plan: 'free', status: 'active' },
        ],
        priceOf,
      ),
    ).toBe(300);
  });
});

describe('buildSubscriptionReport', () => {
  const report = buildSubscriptionReport(
    ['paid', 'free', 'late', 'soon', 'gone', 'none'].map(tenant),
    [
      sub('paid', 'pro', 'active', days(20)),
      sub('free', 'free', 'active', days(2)),
      sub('late', 'starter', 'past_due', days(-3)),
      sub('soon', 'starter', 'active', days(3)),
      sub('gone', 'pro', 'cancelled', days(40)),
    ],
    priceOf,
    now,
  );
  const row = (id: string) => report.rows.find((r) => r.tenantId === id)!;

  it('puts what needs action first', () => {
    expect(report.rows.slice(0, 3).map((r) => r.tenantId)).toEqual([
      'late',
      'soon',
      'paid',
    ]);
  });

  it('only flags paid, active plans as expiring soon', () => {
    expect(row('soon').expiringSoon).toBe(true);
    expect(row('free').expiringSoon).toBe(false);
    expect(row('late').expiringSoon).toBe(false);
    expect(row('paid').expiringSoon).toBe(false);
  });

  it('shows tenants with no subscription record as free', () => {
    expect(row('none')).toMatchObject({
      plan: 'free',
      status: 'active',
      billingPeriodEnd: null,
      monthlyPriceZmw: 0,
    });
  });

  it('summarises without counting unpaid tenants as revenue', () => {
    expect(report.summary).toEqual({
      paying: 2,
      pastDue: 1,
      expiringSoon: 1,
      mrrZmw: 400,
    });
  });
});
