import { Injectable, OnModuleInit } from '@nestjs/common';
import { SystemSettingsService } from '../system_settings/system_settings.service';
import {
  PLAN_CONFIG,
  PlanKey,
  PlanConfig,
  normalizePlanKey,
} from './plan.constants';
import {
  DEFAULT_PLAN_FEATURES,
  DEFAULT_PLAN_HIGHLIGHT,
  DEFAULT_PLAN_TENANT_LIMITS,
} from './plans-seeds.constants';

export const BILLING_PLANS_SETTING_KEY = 'billing_plans';

export type PublicPlan = PlanConfig & {
  key: PlanKey;
  features: string[];
  highlight: boolean;
  tenantLimit: number | null;
};

type StoredPlans = Partial<
  Record<
    PlanKey,
    Partial<PlanConfig> & {
      features?: string[];
      highlight?: boolean;
      tenantLimit?: number | null;
    }
  >
>;

@Injectable()
export class PlansService implements OnModuleInit {
  private cache: Record<PlanKey, PublicPlan> | null = null;

  constructor(private readonly settings: SystemSettingsService) {}

  async onModuleInit(): Promise<void> {
    await this.refreshCache();
  }

  async refreshCache(): Promise<Record<PlanKey, PublicPlan>> {
    this.cache = await this.loadPlans();
    return this.cache;
  }

  getPlansRecord(): Record<PlanKey, PublicPlan> {
    return this.cache ?? this.buildDefaults();
  }

  getPlansList(): PublicPlan[] {
    const record = this.getPlansRecord();
    return (['free', 'starter', 'pro'] as PlanKey[]).map((key) => record[key]);
  }

  getPlan(key: PlanKey | string): PublicPlan {
    const planKey = normalizePlanKey(key);
    return this.getPlansRecord()[planKey];
  }

  getPlanPriceZmw(key: PlanKey | string): number {
    return this.getPlan(key).priceZmw;
  }

  async updatePlans(patch: StoredPlans): Promise<Record<PlanKey, PublicPlan>> {
    const current = this.getPlansRecord();
    const merged: StoredPlans = {};
    for (const key of ['free', 'starter', 'pro'] as PlanKey[]) {
      merged[key] = {
        ...current[key],
        ...(patch[key] ?? {}),
        label: patch[key]?.label ?? current[key].label,
        priceZmw: patch[key]?.priceZmw ?? current[key].priceZmw,
        aiCallsLimit:
          patch[key]?.aiCallsLimit !== undefined
            ? patch[key]!.aiCallsLimit
            : current[key].aiCallsLimit,
        seatLimit:
          patch[key]?.seatLimit !== undefined
            ? patch[key]!.seatLimit
            : current[key].seatLimit,
        dailyWorkflowEnabled:
          patch[key]?.dailyWorkflowEnabled ?? current[key].dailyWorkflowEnabled,
        features: patch[key]?.features ?? current[key].features,
        highlight: patch[key]?.highlight ?? current[key].highlight,
        tenantLimit:
          patch[key]?.tenantLimit !== undefined
            ? patch[key]!.tenantLimit
            : current[key].tenantLimit,
      };
    }
    await this.settings.upsert(BILLING_PLANS_SETTING_KEY, {
      value: merged,
      description: 'Public billing plans (landing page, billing, payments)',
    });
    return this.refreshCache();
  }

  private async loadPlans(): Promise<Record<PlanKey, PublicPlan>> {
    try {
      const ent = await this.settings.findOne(BILLING_PLANS_SETTING_KEY);
      return this.mergeStored(ent.value as StoredPlans);
    } catch {
      return this.buildDefaults();
    }
  }

  private mergeStored(stored?: StoredPlans): Record<PlanKey, PublicPlan> {
    const out = this.buildDefaults();
    if (!stored) return out;
    for (const key of ['free', 'starter', 'pro'] as PlanKey[]) {
      const patch = stored[key];
      if (!patch) continue;
      out[key] = {
        ...out[key],
        ...patch,
        key,
        features: patch.features?.length ? patch.features : out[key].features,
        highlight: patch.highlight ?? out[key].highlight,
        tenantLimit:
          patch.tenantLimit !== undefined
            ? patch.tenantLimit
            : out[key].tenantLimit,
      };
    }
    return out;
  }

  private buildDefaults(): Record<PlanKey, PublicPlan> {
    return {
      free: this.toPublic('free', PLAN_CONFIG.free),
      starter: this.toPublic('starter', PLAN_CONFIG.starter),
      pro: this.toPublic('pro', PLAN_CONFIG.pro),
    };
  }

  private toPublic(key: PlanKey, cfg: PlanConfig): PublicPlan {
    return {
      key,
      ...cfg,
      features: DEFAULT_PLAN_FEATURES[key],
      highlight: DEFAULT_PLAN_HIGHLIGHT[key],
      tenantLimit: DEFAULT_PLAN_TENANT_LIMITS[key],
    };
  }
}
