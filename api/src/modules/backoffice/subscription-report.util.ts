import type { Tenants } from '../tenants/entities/tenants.entity';
import type { TenantSubscriptions } from '../subscriptions/entities/tenant_subscriptions.entity';

export const EXPIRING_SOON_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

type PriceOf = (plan: string) => number;
type SubscriptionFacts = Pick<TenantSubscriptions, 'plan' | 'status'>;
type ReportTenant = Pick<Tenants, 'id' | 'name'> & {
  owner?: { email?: string } | null;
};
type ReportSubscription = Pick<
  TenantSubscriptions,
  | 'tenantId'
  | 'plan'
  | 'status'
  | 'billingPeriodEnd'
  | 'autoRenewEnabled'
  | 'renewalAttempts'
  | 'lastRenewalAttemptAt'
>;

/** Past-due and cancelled tenants aren't paying, so they don't count toward MRR. */
export function monthlyRecurringRevenue(
  subs: SubscriptionFacts[],
  priceOf: PriceOf,
): number {
  return subs
    .filter((sub) => sub.status === 'active')
    .reduce((sum, sub) => sum + priceOf(sub.plan), 0);
}

export function buildSubscriptionReport(
  tenants: ReportTenant[],
  subs: ReportSubscription[],
  priceOf: PriceOf,
  now = new Date(),
) {
  const subByTenant = new Map(subs.map((sub) => [sub.tenantId, sub]));
  const soon = now.getTime() + EXPIRING_SOON_DAYS * DAY_MS;

  const rows = tenants.map((tenant) => {
    const sub = subByTenant.get(tenant.id);
    const plan = sub?.plan ?? 'free';
    const status = sub?.status ?? 'active';
    const monthlyPriceZmw = priceOf(plan);
    const endsAt = sub?.billingPeriodEnd?.getTime();

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      ownerEmail: tenant.owner?.email,
      plan,
      status,
      monthlyPriceZmw,
      billingPeriodEnd: sub?.billingPeriodEnd ?? null,
      autoRenewEnabled: sub?.autoRenewEnabled ?? false,
      renewalAttempts: sub?.renewalAttempts ?? 0,
      lastRenewalAttemptAt: sub?.lastRenewalAttemptAt ?? null,
      expiringSoon:
        status === 'active' &&
        monthlyPriceZmw > 0 &&
        endsAt !== undefined &&
        endsAt > now.getTime() &&
        endsAt <= soon,
    };
  });

  // What needs action comes first: past due, then expiring soonest, then paying, then free.
  const rank = (row: (typeof rows)[number]) => {
    if (row.status === 'past_due') return 0;
    if (row.expiringSoon) return 1;
    return row.monthlyPriceZmw > 0 ? 2 : 3;
  };
  rows.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.billingPeriodEnd?.getTime() ?? 0) - (b.billingPeriodEnd?.getTime() ?? 0),
  );

  return {
    summary: {
      paying: rows.filter((r) => r.status === 'active' && r.monthlyPriceZmw > 0)
        .length,
      pastDue: rows.filter((r) => r.status === 'past_due').length,
      expiringSoon: rows.filter((r) => r.expiringSoon).length,
      mrrZmw: monthlyRecurringRevenue(rows, priceOf),
    },
    rows,
  };
}
