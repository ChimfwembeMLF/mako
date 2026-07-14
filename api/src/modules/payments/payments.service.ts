import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Deposits } from '../deposits/entities/deposits.entity';
import { Tenants } from '../tenants/entities/tenants.entity';
import { RefundRequests } from './entities/refund_requests.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TenantMembersService } from '../tenant_members/tenant_members.service';
import { normalizePlanKey, PlanKey } from '../subscriptions/plan.constants';
import { PlansService } from '../subscriptions/plans.service';
import {
  buildInvoiceNumber,
  invoiceDataFromDeposit,
  renderInvoiceHtml,
  InvoiceData,
} from './invoice.template';
import { getInvoicePdfFilename, renderInvoicePdf } from './invoice.pdf';
import { NotificationsService } from '../notifications/notifications.service';
import {
  postPawaPayDeposit,
  postPawaPayRefund,
  getPawaPayDepositStatus,
  parsePawaPayDepositStatus,
  isPawaPayDepositCompleted,
} from './pawapay.client';
import {
  listPaymentCountryOptions,
  normalizeMobileMoneyPhone,
  resolvePaymentSelection,
} from './payment-countries';
import { FxService } from './fx.service';
import {
  buildPaymentFxPayload,
  resolveAdsCreditZmw,
} from './payment-fx.util';

export interface ClientPaymentRecord {
  id: string;
  invoiceNumber: string;
  plan: string | null | undefined;
  status: string | null | undefined;
  amount: string | null | undefined;
  currency: string | null | undefined;
  method: 'mobile_money';
  network: string | null | undefined;
  phone: string | null | undefined;
  createdAt: string;
  paidAt: string | null;
  canDownloadInvoice: boolean;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Deposits)
    private readonly depositsRepo: Repository<Deposits>,
    @InjectRepository(Tenants)
    private readonly tenantsRepo: Repository<Tenants>,
    @InjectRepository(RefundRequests)
    private readonly refundRequestsRepo: Repository<RefundRequests>,
    private readonly subscriptions: SubscriptionsService,
    private readonly plans: PlansService,
    private readonly tenantMembers: TenantMembersService,
    private readonly config: ConfigService,
    private readonly fx: FxService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}



  listMobileMoneyOptions() {
    return listPaymentCountryOptions();
  }

  quoteFromZmw(amountZmw: number, currency: string) {
    return this.fx.quoteFromZmw(amountZmw, currency);
  }

  quoteToZmw(amount: number, currency: string) {
    return this.fx.quoteToZmw(amount, currency);
  }

  async initiateDeposit(params: {
    tenantId: string;
    plan: string;
    phone?: string;
    correspondent?: string;
    paymentCountryId?: string;
    currency?: string;
    countryCode?: string;
    isRenewal?: boolean;
  }) {
    const plan = normalizePlanKey(params.plan);
    if (plan === 'free') {
      throw new Error('Cannot purchase free plan');
    }

    const selection = resolvePaymentSelection(params);
    const phone = normalizeMobileMoneyPhone(selection.dialCode, params.phone);
    if (!phone) {
      throw new BadRequestException('Phone number is required');
    }

    const depositId = randomUUID();
    const priceZmw = this.plans.getPlanPriceZmw(plan);
    const quote = await this.fx.quoteFromZmw(priceZmw, selection.currency);
    const amount = quote.amount;

    const deposit = await this.depositsRepo.save(
      this.depositsRepo.create({
        depositId,
        tenantId: params.tenantId,
        plan,
        status: 'ACCEPTED',
        amount,
        currency: selection.currency,
        phone,
        msisdn: phone,
        correspondent: selection.correspondent,
        provider: 'mobile_money',
        isRenewal: params.isRenewal ?? false,
        rawPayload: buildPaymentFxPayload({
          paymentCountryId: selection.paymentCountryId,
          countryCode: selection.countryCode,
          amountZmw: String(priceZmw),
          fxRate: String(quote.rate),
          fxAsOf: quote.asOf,
          fxSource: quote.source,
        }),
      }),
    );

    const isRenewal = params.isRenewal ?? false;

    const token = this.config.get<string>('PAWAPAY_API_TOKEN');
    if (token) {
      try {
        const pawapayResult = await postPawaPayDeposit(this.config, {
          depositId: deposit.depositId,
          amount: deposit.amount,
          currency: selection.currency,
          correspondent: deposit.correspondent,
          phone,
          customerMessage: `Mako ${plan} Plan`,
        });
        if (isPawaPayDepositCompleted(pawapayResult?.depositStatus)) {
          await this.completeDeposit(deposit.depositId);
          return {
            paymentId: deposit.depositId,
            status: 'COMPLETED',
            activated: true,
            plan,
            amount,
            currency: selection.currency,
            isRenewal,
            message: isRenewal
              ? 'Renewal payment completed — your plan is active'
              : 'Payment completed — your plan is now active',
          };
        }
      } catch (error) {
        this.logger.error(
          `Failed to initiate deposit with PawaPay for ${deposit.depositId}`,
          error,
        );
        throw error;
      }
    } else {
      this.logger.warn('PAWAPAY_API_TOKEN not configured, skipping PawaPay POST');
    }

    return {
      paymentId: deposit.depositId,
      status: deposit.status,
      activated: false,
      plan,
      amount,
      currency: selection.currency,
      isRenewal,
      message: isRenewal
        ? 'Renewal payment sent — approve the prompt on your phone'
        : 'Payment request sent — approve the prompt on your phone',
    };
  }

  async initiateAdsDeposit(
    params: {
      tenantId: string;
      amount: number;
      phone?: string;
      correspondent?: string;
      paymentCountryId?: string;
      currency?: string;
      countryCode?: string;
    },
    userId?: string,
  ) {
    if (userId) await this.assertTenantAccess(userId, params.tenantId);

    const amount = Number(params.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be a positive number');
    }

    const selection = resolvePaymentSelection(params);
    const phone = normalizeMobileMoneyPhone(selection.dialCode, params.phone);
    if (!phone) {
      throw new BadRequestException('Phone number is required');
    }

    const depositId = randomUUID();
    const chargeQuote = await this.fx.quoteToZmw(amount, selection.currency);
    const amountStr = this.fx.formatChargeAmount(amount, selection.currency);
    const amountZmw = chargeQuote.amountZmw;

    const deposit = await this.depositsRepo.save(
      this.depositsRepo.create({
        depositId,
        tenantId: params.tenantId,
        plan: 'ADS_TOPUP',
        status: 'ACCEPTED',
        amount: amountStr,
        currency: selection.currency,
        phone,
        msisdn: phone,
        correspondent: selection.correspondent,
        provider: 'mobile_money',
        isRenewal: false,
        rawPayload: buildPaymentFxPayload({
          paymentCountryId: selection.paymentCountryId,
          countryCode: selection.countryCode,
          amountZmw,
          fxRate: String(chargeQuote.rate),
          fxAsOf: chargeQuote.asOf,
          fxSource: chargeQuote.source,
        }),
      }),
    );

    const token = this.config.get<string>('PAWAPAY_API_TOKEN');
    if (token) {
      try {
        const pawapayResult = await postPawaPayDeposit(this.config, {
          depositId: deposit.depositId,
          amount: deposit.amount,
          currency: selection.currency,
          correspondent: deposit.correspondent,
          phone,
          customerMessage: 'Mako Ads Topup',
        });
        if (isPawaPayDepositCompleted(pawapayResult?.depositStatus)) {
          await this.completeDeposit(deposit.depositId);
          return {
            paymentId: deposit.depositId,
            status: 'COMPLETED',
            activated: true,
            plan: 'ADS_TOPUP',
            amount: amountStr,
            currency: selection.currency,
            amountZmw,
            isRenewal: false,
            message: 'Payment completed — ads balance updated',
          };
        }
      } catch (error) {
        this.logger.error(
          `Failed to initiate ads deposit with PawaPay for ${deposit.depositId}`,
          error,
        );
        throw error;
      }
    } else {
      this.logger.warn('PAWAPAY_API_TOKEN not configured, skipping PawaPay POST');
    }

    return {
      paymentId: deposit.depositId,
      status: deposit.status,
      activated: false,
      plan: 'ADS_TOPUP',
      amount: amountStr,
      currency: selection.currency,
      amountZmw,
      isRenewal: false,
      message: 'Payment request sent — approve the prompt on your phone',
    };
  }

  async initiateRenewalDeposit(tenantId: string) {
    const sub = await this.subscriptions.getRenewalContext(tenantId);
    const plan = normalizePlanKey(sub.plan);
    if (plan === 'free') {
      throw new Error('Free plan does not renew');
    }
    if (!sub.renewalPhone) {
      throw new Error('No saved mobile money number for auto-renew');
    }
    return this.initiateDeposit({
      tenantId,
      plan,
      phone: sub.renewalPhone,
      correspondent: sub.renewalCorrespondent ?? 'MTN_MOMO_ZMB',
      isRenewal: true,
    });
  }

  async completeDeposit(depositId: string) {
    const deposit = await this.depositsRepo.findOne({ where: { depositId } });
    if (!deposit) throw new Error('Deposit not found');
    if (deposit.status === 'COMPLETED') {
      return {
        alreadyCompleted: true,
        tenantId: deposit.tenantId,
        plan: deposit.plan,
      };
    }

    await this.depositsRepo.update(deposit.id, { status: 'COMPLETED' });

    if (deposit.plan === 'ADS_TOPUP') {
      const amountZmw = resolveAdsCreditZmw(
        deposit.amount,
        deposit.currency,
        deposit.rawPayload,
      );
      if (amountZmw <= 0) {
        throw new BadRequestException('Could not determine ZMW credit for ads top-up');
      }
      await this.tenantsRepo
        .createQueryBuilder()
        .update(Tenants)
        .set({ adsBalance: () => `"ads_balance" + ${amountZmw}` })
        .where('id = :id', { id: deposit.tenantId })
        .execute();

      this.logger.log(
        `Added ${amountZmw} ZMW to ads balance for tenant ${deposit.tenantId} via deposit ${depositId}`,
      );
      return {
        tenantId: deposit.tenantId,
        plan: 'ADS_TOPUP',
        status: 'COMPLETED',
        amount: amountZmw,
        currency: 'ZMW',
      };
    }

    const plan = normalizePlanKey(deposit.plan) as PlanKey;
    const paidAt = new Date();
    await this.subscriptions.activatePlan(deposit.tenantId, plan, paidAt);
    await this.subscriptions.onPaymentCompleted(deposit.tenantId, {
      phone: deposit.phone ?? deposit.msisdn,
      correspondent: deposit.correspondent,
    });
    this.logger.log(
      `${deposit.isRenewal ? 'Renewed' : 'Activated'} ${plan} for tenant ${
        deposit.tenantId
      } via deposit ${depositId}`,
    );
    if (deposit.isRenewal) {
      void this.notifications?.notifyRenewalSuccess({
        tenantId: deposit.tenantId,
        plan,
        amount: deposit.amount ? Number(deposit.amount) : undefined,
      });
    } else {
      void this.notifications?.notifyPaymentSuccess({
        tenantId: deposit.tenantId,
        plan,
        amount: deposit.amount ? Number(deposit.amount) : undefined,
      });
    }
    return { tenantId: deposit.tenantId, plan, status: 'COMPLETED' };
  }

  async checkPendingDeposits(): Promise<{ completed: number }> {
    const pending = await this.depositsRepo
      .createQueryBuilder('deposit')
      .where(
        '(deposit.status IS NULL OR deposit.status NOT IN (:...finalStatuses))',
        { finalStatuses: ['COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED'] },
      )
      .getMany();
    let completed = 0;
    for (const d of pending) {
      const result = await this.checkDepositStatus(d.depositId);
      if (result.status === 'COMPLETED') {
        completed++;
      }
    }
    return { completed };
  }

  async checkDepositStatus(depositId: string) {
    const deposit = await this.depositsRepo.findOne({ where: { depositId } });
    if (!deposit) throw new NotFoundException('Deposit not found');

    if (deposit.status === 'COMPLETED') {
      return { status: 'COMPLETED', activated: true };
    }

    const token = this.config.get<string>('PAWAPAY_API_TOKEN');
    if (!token) {
      this.logger.warn('PAWAPAY_API_TOKEN not configured, skipping status check');
      return { status: deposit.status, activated: false };
    }

    try {
      const data = await getPawaPayDepositStatus(this.config, depositId);
      if (!data) {
        return { status: deposit.status, activated: false };
      }

      return this.applyPawaPayDepositStatus(deposit, parsePawaPayDepositStatus(data));
    } catch (error) {
      this.logger.error(`Failed to check PawaPay status for ${depositId}`, error);
      return { status: deposit.status, activated: false };
    }
  }

  async handlePawaPayWebhook(body: unknown) {
    const parsed = parsePawaPayDepositStatus(body);
    const depositId =
      parsed?.depositId ??
      (typeof body === 'object' &&
      body &&
      'depositId' in body &&
      typeof (body as { depositId?: unknown }).depositId === 'string'
        ? (body as { depositId: string }).depositId
        : undefined);

    if (!depositId) {
      return { received: true };
    }

    if (isPawaPayDepositCompleted(parsed?.depositStatus)) {
      await this.completeDeposit(depositId);
      return { received: true, status: 'COMPLETED', activated: true };
    }

    const deposit = await this.depositsRepo.findOne({ where: { depositId } });
    if (deposit && parsed?.depositStatus) {
      return this.applyPawaPayDepositStatus(deposit, parsed);
    }

    return { received: true };
  }

  private async applyPawaPayDepositStatus(
    deposit: Deposits,
    parsed: ReturnType<typeof parsePawaPayDepositStatus>,
  ) {
    const depositStatus = parsed?.depositStatus;
    if (!depositStatus) {
      return { status: deposit.status, activated: false };
    }

    if (isPawaPayDepositCompleted(depositStatus)) {
      await this.completeDeposit(deposit.depositId);
      return { status: 'COMPLETED', activated: true };
    }

    if (depositStatus !== deposit.status?.toUpperCase()) {
      await this.depositsRepo.update(deposit.id, { status: depositStatus });
      return { status: depositStatus, activated: false };
    }

    return { status: deposit.status, activated: false };
  }

  async findByTenant(
    tenantId: string,
    userId?: string,
  ): Promise<ClientPaymentRecord[]> {
    if (userId) await this.assertTenantAccess(userId, tenantId);
    const rows = await this.depositsRepo.find({
      where: { tenantId },
      order: { created_at: 'DESC' },
    });
    return rows.map((d) => this.toClientRecord(d));
  }

  async generateInvoiceHtml(
    depositId: string,
    tenantId: string,
    userId: string,
  ): Promise<string> {
    const data = await this.getInvoiceData(depositId, tenantId, userId);
    return renderInvoiceHtml(data);
  }

  async generateInvoicePdf(
    depositId: string,
    tenantId: string,
    userId: string,
  ): Promise<Buffer> {
    const data = await this.getInvoiceData(depositId, tenantId, userId);
    return renderInvoicePdf(data);
  }

  getInvoiceFilename(depositId: string): string {
    return getInvoicePdfFilename(depositId);
  }

  private async getInvoiceData(
    depositId: string,
    tenantId: string,
    userId: string,
  ): Promise<InvoiceData> {
    await this.assertTenantAccess(userId, tenantId);
    const deposit = await this.depositsRepo.findOne({
      where: { depositId, tenantId },
    });
    if (!deposit) throw new NotFoundException('Payment record not found');

    const tenant = await this.tenantsRepo.findOne({
      where: { id: tenantId },
      relations: ['owner'],
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    return invoiceDataFromDeposit(deposit, tenant, tenant.owner?.email, {
      label: this.plans.getPlan(deposit.plan ?? 'free').label,
      priceZmw: this.plans.getPlanPriceZmw(deposit.plan ?? 'free'),
    });
  }

  async requestRefund(tenantId: string, depositId: string, reason: string, userId: string) {
    await this.assertTenantAccess(userId, tenantId);

    const deposit = await this.depositsRepo.findOne({
      where: { depositId, tenantId },
    });

    if (!deposit) {
      throw new NotFoundException('Payment record not found');
    }

    if (deposit.status !== 'COMPLETED') {
      throw new BadRequestException('Can only request a refund for completed payments');
    }

    const existing = await this.refundRequestsRepo.findOne({
      where: { depositId: deposit.id },
    });

    if (existing) {
      throw new BadRequestException('A refund request already exists for this payment');
    }

    const request = this.refundRequestsRepo.create({
      tenantId,
      depositId: deposit.id,
      amount: deposit.amount ?? '0',
      reason,
      status: 'PENDING',
    });

    await this.refundRequestsRepo.save(request);

    return { success: true, message: 'Refund requested successfully' };
  }

  async processRefund(refundId: string, adminNotes?: string, approve: boolean = true) {
    const refundReq = await this.refundRequestsRepo.findOne({
      where: { id: refundId },
      relations: ['deposit'],
    });

    if (!refundReq) throw new NotFoundException('Refund request not found');
    if (refundReq.status !== 'PENDING') throw new BadRequestException('Refund request is not pending');

    if (!approve) {
      refundReq.status = 'REJECTED';
      if (adminNotes) refundReq.adminNotes = adminNotes;
      await this.refundRequestsRepo.save(refundReq);
      return refundReq;
    }

    const token = this.config.get<string>('PAWAPAY_API_TOKEN');
    if (!token) throw new BadRequestException('PAWAPAY_API_TOKEN is not configured');
    
    const pawapayRefundId = randomUUID();

    try {
      await postPawaPayRefund(this.config, {
        refundId: pawapayRefundId,
        depositId: refundReq.deposit.depositId,
        amount: refundReq.deposit.amount,
        currency: refundReq.deposit.currency ?? 'ZMW',
      });
      
      refundReq.status = 'APPROVED';
      if (adminNotes) refundReq.adminNotes = adminNotes;
      await this.refundRequestsRepo.save(refundReq);
      
      await this.depositsRepo.update(refundReq.deposit.id, { status: 'REFUNDED' });

      if (refundReq.deposit.plan === 'ADS_TOPUP') {
        const amountZmw = resolveAdsCreditZmw(
          refundReq.deposit.amount,
          refundReq.deposit.currency,
          refundReq.deposit.rawPayload,
        );
        if (amountZmw > 0) {
          await this.tenantsRepo.createQueryBuilder()
            .update(Tenants)
            .set({ adsBalance: () => `"ads_balance" - ${amountZmw}` })
            .where('id = :id', { id: refundReq.tenantId })
            .execute();
        }
      }

      return refundReq;
    } catch (error) {
      this.logger.error(`Failed to process refund with PawaPay for deposit ${refundReq.deposit.depositId}`, error);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Failed to process refund with PawaPay');
    }
  }

  private async assertTenantAccess(userId: string, tenantId: string) {
    const memberships = await this.tenantMembers.findForUser(userId);
    const allowed = memberships.some(
      (m) => m.tenantId === tenantId && m.isActive,
    );
    if (!allowed)
      throw new ForbiddenException('You are not a member of this workspace');
  }

  toClientRecord(d: Deposits): ClientPaymentRecord {
    const status = (d.status ?? '').toUpperCase();
    const isPaid = status === 'COMPLETED';
    return {
      id: d.depositId,
      invoiceNumber: buildInvoiceNumber(d.depositId),
      plan: d.plan,
      status: d.status,
      amount: d.amount,
      currency: d.currency,
      method: 'mobile_money',
      network: d.correspondent ?? null,
      phone: d.phone ?? d.msisdn ?? null,
      createdAt: d.created_at.toISOString(),
      paidAt: isPaid ? d.updated_at.toISOString() : null,
      canDownloadInvoice: isPaid || status === 'ACCEPTED',
    };
  }
}
