import type { PublicPlan } from './api';

export function formatPriceZmw(priceZmw: number): string {
  return `ZMW ${priceZmw.toLocaleString('en-ZM')}`;
}

export function formatPlanLimit(value: number | null, unlimitedLabel = 'Unlimited'): string {
  return value === null ? unlimitedLabel : String(value);
}

export function planFeatureBullets(plan: PublicPlan): string[] {
  if (plan.features.length > 0) return plan.features;

  const ai = formatPlanLimit(plan.aiCallsLimit, 'Unlimited');
  const seats = formatPlanLimit(plan.seatLimit, 'Unlimited');
  const workspaces = formatPlanLimit(plan.tenantLimit, 'Unlimited');

  return [
    `${ai} AI generations/month`,
    `${seats} team seats`,
    plan.dailyWorkflowEnabled
      ? 'Daily auto-generate at 08:00'
      : 'Manual content only (no daily auto-generate)',
    `${workspaces} workspace${plan.tenantLimit === 1 ? '' : 's'}`,
  ];
}
