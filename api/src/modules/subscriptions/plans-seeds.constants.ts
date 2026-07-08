import { PLAN_CONFIG, PlanKey } from './plan.constants';

export const DEFAULT_PLAN_FEATURES: Record<PlanKey, string[]> = {
  free: ['100 AI calls/mo', '2 seats', '1 workspace'],
  starter: [
    '500 AI calls/mo',
    '10 seats',
    'Daily workflow',
    'Approvals & audit',
  ],
  pro: ['Unlimited AI', 'Unlimited seats', 'Priority support'],
};

export const DEFAULT_PLAN_HIGHLIGHT: Record<PlanKey, boolean> = {
  free: false,
  starter: true,
  pro: false,
};

export const DEFAULT_PLAN_TENANT_LIMITS: Record<PlanKey, number | null> = {
  free: 1,
  starter: 3,
  pro: null,
};

export type BillingPlanSeed = {
  label: string;
  priceZmw: number;
  aiCallsLimit: number | null;
  seatLimit: number | null;
  tenantLimit: number | null;
  dailyWorkflowEnabled: boolean;
  features: string[];
  highlight: boolean;
};

export type BillingPlansSeed = Record<PlanKey, BillingPlanSeed>;

export function buildDefaultBillingPlans(): BillingPlansSeed {
  return (['free', 'starter', 'pro'] as PlanKey[]).reduce((acc, key) => {
    acc[key] = {
      ...PLAN_CONFIG[key],
      features: DEFAULT_PLAN_FEATURES[key],
      highlight: DEFAULT_PLAN_HIGHLIGHT[key],
      tenantLimit: DEFAULT_PLAN_TENANT_LIMITS[key],
    };
    return acc;
  }, {} as BillingPlansSeed);
}
