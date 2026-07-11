import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import axios from 'axios';
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
    @Optional() private readonly notifications?: NotificationsService,
  ) {}



  async initiateDeposit(params: {
    tenantId: string;
    plan: string;
    phone?: string;
    correspondent?: string;
    isRenewal?: boolean;
  }) {
    const plan = normalizePlanKey(params.plan);
    if (plan === 'free') {
      throw new Error('Cannot purchase free plan');
    }

    const depositId = randomUUID();
    const amount = String(this.plans.getPlanPriceZmw(plan));

    const deposit = await this.depositsRepo.save(
      this.depositsRepo.create({
        depositId,
        tenantId: params.tenantId,
        plan,
        status: 'ACCEPTED',
        amount,
        currency: 'ZMW',
        phone: params.phone,
        msisdn: params.phone,
        correspondent: params.correspondent ?? 'MTN_MOMO_ZMB',
        provider: 'mobile_money',
        isRenewal: params.isRenewal ?? false,
      }),
    );

    const token = this.config.get<string>('PAWAPAY_API_TOKEN');
    if (token) {
      const isSandbox = this.config.get<string>('PAWAPAY_ENV') === 'sandbox';
      const baseUrl = isSandbox 
        ? this.config.get<string>('PAWAPAY_SANDBOX_API_URL') || 'https://api.sandbox.pawapay.cloud/v1' 
        : this.config.get<string>('PAWAPAY_API_URL') || 'https://api.pawapay.io/v1';

      try {
        await axios.post(
          `${baseUrl}/deposits`,
          {
            depositId: deposit.depositId,
            amount: deposit.amount,
            currency: 'ZMW',
            country: 'ZMB',
            correspondent: deposit.correspondent,
            payer: {
              type: 'MSISDN',
              address: { value: params.phone },
            },
            statementDescription: `Mako ${plan} Plan`,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      } catch (error) {
        this.logger.error(`Failed to initiate deposit with PawaPay for ${deposit.depositId}`, error);
        throw new Error('Failed to communicate with payment gateway');
      }
    } else {
      this.logger.warn('PAWAPAY_API_TOKEN not configured, skipping PawaPay POST');
    }

    const isRenewal = params.isRenewal ?? false;
    return {
      paymentId: deposit.depositId,
      status: deposit.status,
      activated: false,
      plan,
      amount,
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
    },
    userId?: string,
  ) {
    if (userId) await this.assertTenantAccess(userId, params.tenantId);

    const amount = Number(params.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be a positive number');
    }

    const depositId = randomUUID();
    const amountStr = String(amount);

    const deposit = await this.depositsRepo.save(
      this.depositsRepo.create({
        depositId,
        tenantId: params.tenantId,
        plan: 'ADS_TOPUP',
        status: 'ACCEPTED',
        amount: amountStr,
        currency: 'ZMW',
        phone: params.phone,
        msisdn: params.phone,
        correspondent: params.correspondent ?? 'MTN_MOMO_ZMB',
        provider: 'mobile_money',
        isRenewal: false,
      }),
    );

    const token = this.config.get<string>('PAWAPAY_API_TOKEN');
    if (token) {
      const isSandbox = this.config.get<string>('PAWAPAY_ENV') === 'sandbox';
      const baseUrl = isSandbox 
        ? this.config.get<string>('PAWAPAY_SANDBOX_API_URL') || 'https://api.sandbox.pawapay.cloud/v1' 
        : this.config.get<string>('PAWAPAY_API_URL') || 'https://api.pawapay.io/v1';

      try {
        await axios.post(
          `${baseUrl}/deposits`,
          {
            depositId: deposit.depositId,
            amount: deposit.amount,
            currency: 'ZMW',
            country: 'ZMB',
            correspondent: deposit.correspondent,
            payer: {
              type: 'MSISDN',
              address: { value: params.phone },
            },
            statementDescription: `Mako Ads Topup`,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      } catch (error) {
        this.logger.error(`Failed to initiate ads deposit with PawaPay for ${deposit.depositId}`, error);
        throw new Error('Failed to communicate with payment gateway');
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
      const amount = Number(deposit.amount) || 0;
      await this.tenantsRepo
        .createQueryBuilder()
        .update(Tenants)
        .set({ adsBalance: () => `"ads_balance" + ${amount}` })
        .where('id = :id', { id: deposit.tenantId })
        .execute();

      this.logger.log(
        `Added ${amount} ZMW to ads balance for tenant ${deposit.tenantId} via deposit ${depositId}`,
      );
      return {
        tenantId: deposit.tenantId,
        plan: 'ADS_TOPUP',
        status: 'COMPLETED',
        amount,
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
    const pending = await this.depositsRepo.find({
      where: { status: 'ACCEPTED' },
    });
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
      return { status: 'COMPLETED' };
    }

    const token = this.config.get<string>('PAWAPAY_API_TOKEN');
    if (!token) {
      this.logger.warn('PAWAPAY_API_TOKEN not configured, skipping status check');
      return { status: deposit.status };
    }

    const isSandbox = this.config.get<string>('PAWAPAY_ENV') === 'sandbox';
    const baseUrl = isSandbox 
      ? this.config.get<string>('PAWAPAY_SANDBOX_API_URL') || 'https://api.sandbox.pawapay.cloud/v1' 
      : this.config.get<string>('PAWAPAY_API_URL') || 'https://api.pawapay.io/v1';

    try {
      const response = await axios.get(`${baseUrl}/deposits/${depositId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = response.data;
      if (Array.isArray(data) && data.length > 0) {
        const depositData = data[0];
        const newStatus = depositData.status;

        if (newStatus === 'COMPLETED' && deposit.status !== 'COMPLETED') {
          await this.completeDeposit(depositId);
          return { status: 'COMPLETED' };
        } else if (newStatus !== deposit.status) {
          await this.depositsRepo.update(deposit.id, { status: newStatus });
          return { status: newStatus };
        }
      } else if (!Array.isArray(data) && data.status) {
        const newStatus = data.status;
        if (newStatus === 'COMPLETED' && deposit.status !== 'COMPLETED') {
          await this.completeDeposit(depositId);
          return { status: 'COMPLETED' };
        } else if (newStatus !== deposit.status) {
          await this.depositsRepo.update(deposit.id, { status: newStatus });
          return { status: newStatus };
        }
      }
      return { status: deposit.status };
    } catch (error) {
      this.logger.error(`Failed to check PawaPay status for ${depositId}`, error);
      return { status: deposit.status };
    }
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
    
    const isSandbox = this.config.get<string>('PAWAPAY_ENV') === 'sandbox';
    const baseUrl = isSandbox 
      ? this.config.get<string>('PAWAPAY_SANDBOX_API_URL') || 'https://api.sandbox.pawapay.cloud/v1' 
      : this.config.get<string>('PAWAPAY_API_URL') || 'https://api.pawapay.io/v1';

    const pawapayRefundId = randomUUID();

    try {
      await axios.post(`${baseUrl}/refunds`, {
        refundId: pawapayRefundId,
        depositId: refundReq.deposit.depositId,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      refundReq.status = 'APPROVED';
      if (adminNotes) refundReq.adminNotes = adminNotes;
      await this.refundRequestsRepo.save(refundReq);
      
      await this.depositsRepo.update(refundReq.deposit.id, { status: 'REFUNDED' });

      if (refundReq.deposit.plan === 'ADS_TOPUP') {
        const amount = Number(refundReq.deposit.amount) || 0;
        await this.tenantsRepo.createQueryBuilder()
          .update(Tenants)
          .set({ adsBalance: () => `"ads_balance" - ${amount}` })
          .where('id = :id', { id: refundReq.tenantId })
          .execute();
      }

      return refundReq;
    } catch (error) {
      this.logger.error(`Failed to process refund with PawaPay for deposit ${refundReq.deposit.depositId}`, error);
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
