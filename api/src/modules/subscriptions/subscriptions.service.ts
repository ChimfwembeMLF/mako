import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { TenantSubscriptions } from './entities/tenant_subscriptions.entity';
import { AiUsage } from '../ai_usage/entities/ai_usage.entity';
import { Deposits } from '../deposits/entities/deposits.entity';
import { PlanKey, normalizePlanKey } from './plan.constants';
import { PlansService } from './plans.service';

export interface SubscriptionSummary {
  tenantId: string;
  plan: PlanKey;
  status: string;
  dailyWorkflowEnabled: boolean;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  aiCallsLimit: number | null;
  aiCallsUsed: number;
  aiCallsRemaining: number | null;
  seatLimit: number | null;
  autoRenewEnabled: boolean;
  renewalPhone: string | null;
  renewalCorrespondent: string | null;
  hasRenewalMethod: boolean;
}

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(TenantSubscriptions)
    private readonly subRepo: Repository<TenantSubscriptions>,
    @InjectRepository(AiUsage)
    private readonly usageRepo: Repository<AiUsage>,
    @InjectRepository(Deposits)
    private readonly depositsRepo: Repository<Deposits>,
    private readonly plans: PlansService,
  ) {}

  /** Free tier: usage resets on the 1st of each calendar month. */
  private calendarMonthBounds(): { start: Date; end: Date } {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    return { start, end };
  }

  /** Paid plans: one month from the payment date (e.g. Jun 13 → Jul 13). */
  private paymentPeriodBounds(paidAt: Date): { start: Date; end: Date } {
    const start = new Date(paidAt);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    return { start, end };
  }

  async ensureForTenant(
    tenantId: string,
    plan: PlanKey = 'free',
  ): Promise<TenantSubscriptions> {
    let sub = await this.subRepo.findOne({ where: { tenantId } });
    if (sub) return sub;

    const { start, end } = this.calendarMonthBounds();
    const cfg = this.plans.getPlan(plan);
    sub = await this.subRepo.save(
      this.subRepo.create({
        tenantId,
        plan,
        status: 'active',
        dailyWorkflowEnabled: cfg.dailyWorkflowEnabled,
        billingPeriodStart: start,
        billingPeriodEnd: end,
      }),
    );
    return sub;
  }

  async getSummary(tenantId: string): Promise<SubscriptionSummary> {
    let sub = await this.ensureForTenant(tenantId);
    sub = (await this.alignBillingPeriodFromLastPayment(sub)) ?? sub;
    sub = (await this.syncRenewalFromLatestPayment(sub)) ?? sub;
    const plan = normalizePlanKey(sub.plan);
    const cfg = this.plans.getPlan(plan);
    const used = await this.countAiCalls(
      tenantId,
      sub.billingPeriodStart,
      sub.billingPeriodEnd,
    );
    const limit = cfg.aiCallsLimit;
    return {
      tenantId,
      plan,
      status: sub.status,
      dailyWorkflowEnabled: sub.dailyWorkflowEnabled && sub.status === 'active',
      billingPeriodStart: sub.billingPeriodStart.toISOString(),
      billingPeriodEnd: sub.billingPeriodEnd.toISOString(),
      aiCallsLimit: limit,
      aiCallsUsed: used,
      aiCallsRemaining: limit === null ? null : Math.max(0, limit - used),
      seatLimit: cfg.seatLimit,
      autoRenewEnabled: sub.autoRenewEnabled ?? false,
      renewalPhone: sub.renewalPhone ?? null,
      renewalCorrespondent: sub.renewalCorrespondent ?? null,
      hasRenewalMethod: Boolean(sub.renewalPhone),
    };
  }

  async countAiCalls(tenantId: string, from: Date, to: Date): Promise<number> {
    return this.usageRepo.count({
      where: {
        tenantId,
        created_at: Between(from, to),
      },
    });
  }

  async canUseAi(
    tenantId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const sub = await this.ensureForTenant(tenantId);
    if (sub.status === 'cancelled') {
      return {
        allowed: false,
        reason: 'Subscription cancelled. Renew on the Billing page.',
      };
    }
    if (sub.status === 'past_due') {
      return {
        allowed: false,
        reason: 'Subscription payment is past due. Renew on the Billing page.',
      };
    }
    if (sub.status !== 'active') {
      return {
        allowed: false,
        reason: 'Subscription is not active. Please renew your plan.',
      };
    }
    const plan = normalizePlanKey(sub.plan);
    if (plan !== 'free' && sub.billingPeriodEnd < new Date()) {
      return {
        allowed: false,
        reason: 'Your billing period has ended. Renew on the Billing page.',
      };
    }
    const limit = this.plans.getPlan(plan).aiCallsLimit;
    if (limit === null) return { allowed: true };
    const used = await this.countAiCalls(
      tenantId,
      sub.billingPeriodStart,
      sub.billingPeriodEnd,
    );
    if (used >= limit) {
      return {
        allowed: false,
        reason: `AI usage limit reached (${used}/${limit} calls this billing period). Upgrade your plan.`,
      };
    }
    return { allowed: true };
  }

  async assertCanUseAi(tenantId: string): Promise<void> {
    const check = await this.canUseAi(tenantId);
    if (!check.allowed) {
      throw new ForbiddenException(check.reason ?? 'AI usage not allowed');
    }
  }

  async canRunDailyWorkflow(
    tenantId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const sub = await this.ensureForTenant(tenantId);
    if (sub.status !== 'active') {
      return { allowed: false, reason: 'Subscription is not active' };
    }
    if (!sub.dailyWorkflowEnabled) {
      return {
        allowed: false,
        reason:
          'Daily auto-generate requires Starter or Pro. Upgrade on the Billing page.',
      };
    }
    return this.canUseAi(tenantId);
  }

  async assertCanRunDailyWorkflow(tenantId: string): Promise<void> {
    const check = await this.canRunDailyWorkflow(tenantId);
    if (!check.allowed) {
      throw new ForbiddenException(
        check.reason ?? 'Daily workflow not allowed',
      );
    }
  }

  async activatePlan(
    tenantId: string,
    planKey: PlanKey,
    paidAt = new Date(),
  ): Promise<TenantSubscriptions> {
    const plan = normalizePlanKey(planKey);
    if (plan === 'free') {
      throw new ForbiddenException('Cannot activate free plan via payment');
    }
    const cfg = this.plans.getPlan(plan);
    const { start, end } = this.paymentPeriodBounds(paidAt);
    const sub = await this.ensureForTenant(tenantId);
    sub.plan = plan;
    sub.status = 'active';
    sub.dailyWorkflowEnabled = cfg.dailyWorkflowEnabled;
    sub.billingPeriodStart = start;
    sub.billingPeriodEnd = end;
    sub.renewalAttempts = 0;
    return this.subRepo.save(sub);
  }

  async onPaymentCompleted(
    tenantId: string,
    params: {
      phone?: string;
      correspondent?: string;
      enableAutoRenew?: boolean;
    },
  ): Promise<void> {
    const sub = await this.ensureForTenant(tenantId);
    if (params.phone) sub.renewalPhone = params.phone.trim();
    if (params.correspondent) sub.renewalCorrespondent = params.correspondent;
    if (params.enableAutoRenew !== false && sub.renewalPhone) {
      sub.autoRenewEnabled = true;
    }
    sub.renewalAttempts = 0;
    sub.status = 'active';
    await this.subRepo.save(sub);
  }

  async setAutoRenew(
    tenantId: string,
    enabled: boolean,
  ): Promise<TenantSubscriptions> {
    const sub = await this.ensureForTenant(tenantId);
    const plan = normalizePlanKey(sub.plan);
    if (enabled && plan === 'free') {
      throw new ForbiddenException('Auto-renew requires a paid plan');
    }
    if (enabled && !sub.renewalPhone) {
      throw new ForbiddenException(
        'Pay once with mobile money to save your number for auto-renew',
      );
    }
    sub.autoRenewEnabled = enabled;
    return this.subRepo.save(sub);
  }

  async markPastDue(tenantId: string): Promise<void> {
    const sub = await this.ensureForTenant(tenantId);
    if (sub.status !== 'active') return;
    sub.status = 'past_due';
    await this.subRepo.save(sub);
  }

  async downgradeToFree(tenantId: string): Promise<void> {
    const sub = await this.ensureForTenant(tenantId);
    const { start, end } = this.calendarMonthBounds();
    const cfg = this.plans.getPlan('free');
    sub.plan = 'free';
    sub.status = 'active';
    sub.dailyWorkflowEnabled = cfg.dailyWorkflowEnabled;
    sub.autoRenewEnabled = false;
    sub.renewalAttempts = 0;
    sub.billingPeriodStart = start;
    sub.billingPeriodEnd = end;
    await this.subRepo.save(sub);
  }

  async recordRenewalAttempt(tenantId: string): Promise<void> {
    const sub = await this.ensureForTenant(tenantId);
    sub.renewalAttempts = (sub.renewalAttempts ?? 0) + 1;
    sub.lastRenewalAttemptAt = new Date();
    await this.subRepo.save(sub);
  }

  async getRenewalContext(tenantId: string): Promise<TenantSubscriptions> {
    return this.ensureForTenant(tenantId);
  }

  /** Fix paid subs still on calendar-month windows after a payment. */
  private async alignBillingPeriodFromLastPayment(
    sub: TenantSubscriptions,
  ): Promise<TenantSubscriptions | null> {
    const plan = normalizePlanKey(sub.plan);
    if (plan === 'free') return null;

    const latest = await this.depositsRepo.findOne({
      where: { tenantId: sub.tenantId, status: 'COMPLETED' },
      order: { updated_at: 'DESC' },
    });
    if (!latest) return null;

    const paidAt = latest.updated_at ?? latest.created_at;
    const expected = this.paymentPeriodBounds(paidAt);
    const needsAlign =
      sub.billingPeriodStart.getTime() !== expected.start.getTime() ||
      sub.billingPeriodEnd.getTime() !== expected.end.getTime();

    if (!needsAlign || paidAt < sub.billingPeriodStart) {
      return this.syncRenewalMethodFromDeposit(sub, latest);
    }

    sub.billingPeriodStart = expected.start;
    sub.billingPeriodEnd = expected.end;
    const saved = await this.subRepo.save(sub);
    return this.syncRenewalMethodFromDeposit(saved, latest);
  }

  /** Backfill saved mobile money from latest completed payment. */
  private async syncRenewalMethodFromDeposit(
    sub: TenantSubscriptions,
    deposit: Deposits,
  ): Promise<TenantSubscriptions | null> {
    const phone = deposit.phone ?? deposit.msisdn;
    if (!phone) return null;
    let changed = false;
    if (!sub.renewalPhone) {
      sub.renewalPhone = phone;
      changed = true;
    }
    if (deposit.correspondent && !sub.renewalCorrespondent) {
      sub.renewalCorrespondent = deposit.correspondent;
      changed = true;
    }
    if (normalizePlanKey(sub.plan) !== 'free' && !sub.autoRenewEnabled) {
      sub.autoRenewEnabled = true;
      changed = true;
    }
    if (!changed) return null;
    return this.subRepo.save(sub);
  }

  /** Backfill renewal method when only period alignment was skipped. */
  private async syncRenewalFromLatestPayment(
    sub: TenantSubscriptions,
  ): Promise<TenantSubscriptions | null> {
    if (normalizePlanKey(sub.plan) === 'free') return null;
    const latest = await this.depositsRepo.findOne({
      where: { tenantId: sub.tenantId, status: 'COMPLETED' },
      order: { updated_at: 'DESC' },
    });
    if (!latest) return null;
    return this.syncRenewalMethodFromDeposit(sub, latest);
  }

  async findEligibleForDailyCron(): Promise<string[]> {
    const subs = await this.subRepo.find({
      where: { status: 'active', dailyWorkflowEnabled: true },
    });
    const eligible: string[] = [];
    for (const sub of subs) {
      const check = await this.canUseAi(sub.tenantId);
      if (check.allowed) eligible.push(sub.tenantId);
    }
    return eligible;
  }
}
