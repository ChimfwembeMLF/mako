import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, In } from 'typeorm';
import { TenantSubscriptions } from '../subscriptions/entities/tenant_subscriptions.entity';
import { Deposits } from '../deposits/entities/deposits.entity';
import { PaymentsService } from './payments.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { normalizePlanKey } from '../subscriptions/plan.constants';
import {
  MAX_RENEWAL_ATTEMPTS,
  RENEWAL_GRACE_DAYS,
  RENEWAL_WINDOW_HOURS,
} from './subscription-renewal.constants';

@Injectable()
export class SubscriptionRenewalService {
  private readonly logger = new Logger(SubscriptionRenewalService.name);

  constructor(
    @InjectRepository(TenantSubscriptions)
    private readonly subRepo: Repository<TenantSubscriptions>,
    @InjectRepository(Deposits)
    private readonly depositsRepo: Repository<Deposits>,
    private readonly payments: PaymentsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly notifications: NotificationsService,
  ) {}

  async processDueRenewals(): Promise<{ initiated: number; pastDue: number; expired: number }> {
    const now = new Date();
    const renewalWindowEnd = new Date(now.getTime() + RENEWAL_WINDOW_HOURS * 60 * 60 * 1000);
    const graceCutoff = new Date(now.getTime() - RENEWAL_GRACE_DAYS * 24 * 60 * 60 * 1000);

    const subs = await this.subRepo.find({
      where: { status: In(['active', 'past_due']) },
    });

    let initiated = 0;
    let pastDue = 0;
    let expired = 0;

    for (const sub of subs) {
      const plan = normalizePlanKey(sub.plan);
      if (plan === 'free') continue;

      const periodEnded = sub.billingPeriodEnd <= now;
      const inRenewalWindow = sub.billingPeriodEnd <= renewalWindowEnd;

      if (periodEnded && sub.status === 'active') {
        const renewed = await this.hasCompletedPaymentSince(sub.tenantId, sub.billingPeriodStart);
        if (!renewed) {
          await this.subscriptions.markPastDue(sub.tenantId);
          await this.notifications.notifySubscriptionPastDue(sub.tenantId, plan);
          pastDue++;
        }
      }

      if (periodEnded && sub.billingPeriodEnd <= graceCutoff && sub.status === 'past_due') {
        const renewed = await this.hasCompletedPaymentSince(sub.tenantId, sub.billingPeriodStart);
        if (!renewed) {
          await this.subscriptions.downgradeToFree(sub.tenantId);
          await this.notifications.notifySubscriptionExpired(sub.tenantId, plan);
          expired++;
          continue;
        }
      }

      if (!sub.autoRenewEnabled || !sub.renewalPhone) continue;
      if (!inRenewalWindow) continue;
      if (sub.renewalAttempts >= MAX_RENEWAL_ATTEMPTS) {
        await this.subscriptions.setAutoRenew(sub.tenantId, false);
        await this.notifications.notifyRenewalFailed(sub.tenantId, plan, 'Max renewal attempts reached');
        continue;
      }
      if (await this.hasPendingRenewal(sub.tenantId)) continue;
      if (await this.hasCompletedPaymentSince(sub.tenantId, sub.billingPeriodStart)) continue;

      try {
        const result = await this.payments.initiateRenewalDeposit(sub.tenantId);
        await this.subscriptions.recordRenewalAttempt(sub.tenantId);
        await this.notifications.notifyRenewalInitiated(sub.tenantId, plan, result.paymentId);
        initiated++;
        this.logger.log(`Renewal initiated for tenant ${sub.tenantId} (${plan})`);
      } catch (err) {
        this.logger.warn(`Renewal failed for tenant ${sub.tenantId}: ${err instanceof Error ? err.message : err}`);
        await this.notifications.notifyRenewalFailed(
          sub.tenantId,
          plan,
          err instanceof Error ? err.message : 'Could not initiate renewal',
        );
      }
    }

    return { initiated, pastDue, expired };
  }

  private async hasPendingRenewal(tenantId: string): Promise<boolean> {
    const pending = await this.depositsRepo.findOne({
      where: { tenantId, status: 'ACCEPTED', isRenewal: true },
      order: { created_at: 'DESC' },
    });
    return !!pending;
  }

  private async hasCompletedPaymentSince(tenantId: string, since: Date): Promise<boolean> {
    const paid = await this.depositsRepo.findOne({
      where: {
        tenantId,
        status: 'COMPLETED',
        updated_at: MoreThan(since),
      },
      order: { updated_at: 'DESC' },
    });
    return !!paid;
  }
}
