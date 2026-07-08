export type PlanKey = 'free' | 'starter' | 'pro';

export interface PlanConfig {
  label: string;
  aiCallsLimit: number | null;
  dailyWorkflowEnabled: boolean;
  seatLimit: number | null;
  priceZmw: number;
}

export const PLAN_CONFIG: Record<PlanKey, PlanConfig> = {
  free: {
    label: 'Free',
    aiCallsLimit: 100,
    dailyWorkflowEnabled: false,
    seatLimit: 2,
    priceZmw: 0,
  },
  starter: {
    label: 'Starter',
    aiCallsLimit: 500,
    dailyWorkflowEnabled: true,
    seatLimit: 10,
    priceZmw: 375,
  },
  pro: {
    label: 'Pro',
    aiCallsLimit: null,
    dailyWorkflowEnabled: true,
    seatLimit: null,
    priceZmw: 875,
  },
};

export function normalizePlanKey(plan?: string | null): PlanKey {
  if (plan === 'starter' || plan === 'pro') return plan;
  return 'free';
}
