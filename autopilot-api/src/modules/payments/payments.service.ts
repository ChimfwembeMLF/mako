import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Deposits } from '../deposits/entities/deposits.entity';
import { Tenants } from '../tenants/entities/tenants.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TenantMembersService } from '../tenant_members/tenant_members.service';
import { normalizePlanKey, PlanKey, PLAN_CONFIG } from '../subscriptions/plan.constants';
import { buildInvoiceNumber, invoiceDataFromDeposit, renderInvoiceHtml, InvoiceData } from './invoice.template';
import { getInvoicePdfFilename, renderInvoicePdf } from './invoice.pdf';

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
    private readonly subscriptions: SubscriptionsService,
    private readonly tenantMembers: TenantMembersService,
    private readonly config: ConfigService,
  ) {}

  /** Server-only flag; accepts legacy env name for local dev. */
  private devAutoCompleteEnabled(): boolean {
    return (
      this.config.get<string>('PAYMENTS_DEV_AUTO_COMPLETE') === 'true' ||
      this.config.get<string>('PAWAPAY_DEV_AUTO_COMPLETE') === 'true'
    );
  }

  async initiateDeposit(params: {
    tenantId: string;
    plan: string;
    phone?: string;
    correspondent?: string;
  }) {
    const plan = normalizePlanKey(params.plan);
    if (plan === 'free') {
      throw new Error('Cannot purchase free plan');
    }

    const depositId = randomUUID();
    const amount = String(PLAN_CONFIG[plan].priceZmw);

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
      }),
    );

    if (this.devAutoCompleteEnabled()) {
      await this.completeDeposit(deposit.depositId);
    }

    const autoComplete = this.devAutoCompleteEnabled();
    return {
      paymentId: deposit.depositId,
      status: deposit.status,
      plan,
      amount,
      message: autoComplete
        ? 'Payment completed successfully'
        : 'Payment request sent — approve the prompt on your phone',
    };
  }

  async completeDeposit(depositId: string) {
    const deposit = await this.depositsRepo.findOne({ where: { depositId } });
    if (!deposit) throw new Error('Deposit not found');
    if (deposit.status === 'COMPLETED') {
      return { alreadyCompleted: true, tenantId: deposit.tenantId, plan: deposit.plan };
    }

    await this.depositsRepo.update(deposit.id, { status: 'COMPLETED' });
    const plan = normalizePlanKey(deposit.plan) as PlanKey;
    await this.subscriptions.activatePlan(deposit.tenantId, plan);
    this.logger.log(`Activated ${plan} for tenant ${deposit.tenantId} via deposit ${depositId}`);
    return { tenantId: deposit.tenantId, plan, status: 'COMPLETED' };
  }

  async checkPendingDeposits(): Promise<{ completed: number }> {
    const pending = await this.depositsRepo.find({
      where: { status: 'ACCEPTED' },
    });
    let completed = 0;
    for (const d of pending) {
      if (this.devAutoCompleteEnabled()) {
        await this.completeDeposit(d.depositId);
        completed++;
      }
    }
    return { completed };
  }

  async findByTenant(tenantId: string, userId?: string): Promise<ClientPaymentRecord[]> {
    if (userId) await this.assertTenantAccess(userId, tenantId);
    const rows = await this.depositsRepo.find({
      where: { tenantId },
      order: { created_at: 'DESC' },
    });
    return rows.map((d) => this.toClientRecord(d));
  }

  async generateInvoiceHtml(depositId: string, tenantId: string, userId: string): Promise<string> {
    const data = await this.getInvoiceData(depositId, tenantId, userId);
    return renderInvoiceHtml(data);
  }

  async generateInvoicePdf(depositId: string, tenantId: string, userId: string): Promise<Buffer> {
    const data = await this.getInvoiceData(depositId, tenantId, userId);
    return renderInvoicePdf(data);
  }

  getInvoiceFilename(depositId: string): string {
    return getInvoicePdfFilename(depositId);
  }

  private async getInvoiceData(depositId: string, tenantId: string, userId: string): Promise<InvoiceData> {
    await this.assertTenantAccess(userId, tenantId);
    const deposit = await this.depositsRepo.findOne({ where: { depositId, tenantId } });
    if (!deposit) throw new NotFoundException('Payment record not found');

    const tenant = await this.tenantsRepo.findOne({
      where: { id: tenantId },
      relations: ['owner'],
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    return invoiceDataFromDeposit(deposit, tenant, tenant.owner?.email);
  }

  private async assertTenantAccess(userId: string, tenantId: string) {
    const memberships = await this.tenantMembers.findForUser(userId);
    const allowed = memberships.some((m) => m.tenantId === tenantId && m.isActive);
    if (!allowed) throw new ForbiddenException('You are not a member of this workspace');
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
