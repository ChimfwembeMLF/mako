import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenants } from '../tenants/entities/tenants.entity';
import { UserEntity } from '../user/user.entity';
import { Deposits } from '../deposits/entities/deposits.entity';
import { TenantSubscriptions } from '../subscriptions/entities/tenant_subscriptions.entity';
import { AiUsage } from '../ai_usage/entities/ai_usage.entity';
import { ContentItems } from '../content_items/entities/content_items.entity';
import { ContentPublications } from '../content_publications/entities/content_publications.entity';
import { TenantMembers } from '../tenant_members/entities/tenant_members.entity';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { Leads } from '../leads/entities/leads.entity';
import { AuditLogs } from '../audit_logs/entities/audit_logs.entity';
import { CommentReplies } from '../comment_replies/entities/comment_replies.entity';
import { DataDeletionRequests } from '../legal/entities/data_deletion_requests.entity';

@Injectable()
export class BackofficeService {
  constructor(
    @InjectRepository(Tenants) private readonly tenantsRepo: Repository<Tenants>,
    @InjectRepository(UserEntity) private readonly usersRepo: Repository<UserEntity>,
    @InjectRepository(Deposits) private readonly depositsRepo: Repository<Deposits>,
    @InjectRepository(TenantSubscriptions) private readonly subsRepo: Repository<TenantSubscriptions>,
    @InjectRepository(AiUsage) private readonly aiUsageRepo: Repository<AiUsage>,
    @InjectRepository(ContentItems) private readonly contentRepo: Repository<ContentItems>,
    @InjectRepository(ContentPublications) private readonly pubsRepo: Repository<ContentPublications>,
    @InjectRepository(TenantMembers) private readonly membersRepo: Repository<TenantMembers>,
    @InjectRepository(SocialAccounts) private readonly socialRepo: Repository<SocialAccounts>,
    @InjectRepository(Leads) private readonly leadsRepo: Repository<Leads>,
    @InjectRepository(AuditLogs) private readonly auditRepo: Repository<AuditLogs>,
    @InjectRepository(CommentReplies) private readonly commentsRepo: Repository<CommentReplies>,
    @InjectRepository(DataDeletionRequests) private readonly deletionRepo: Repository<DataDeletionRequests>,
  ) {}

  async getOverview() {
    const [
      tenantCount,
      userCount,
      memberCount,
      contentCount,
      publishedCount,
      connectedSocial,
      leadsCount,
      auditCount,
      commentCount,
      pendingDeletions,
      deposits,
      subs,
      aiRows,
      recentAudit,
      deletionRequests,
    ] = await Promise.all([
      this.tenantsRepo.count(),
      this.usersRepo.count(),
      this.membersRepo.count({ where: { isActive: true } }),
      this.contentRepo.count(),
      this.pubsRepo.count({ where: { status: 'published' } }),
      this.socialRepo.count({ where: { connected: true } }),
      this.leadsRepo.count(),
      this.auditRepo.count(),
      this.commentsRepo.count(),
      this.deletionRepo.count({ where: { status: 'pending' } }),
      this.depositsRepo.find({ order: { created_at: 'DESC' }, take: 500 }),
      this.subsRepo.find(),
      this.aiUsageRepo.find({ order: { created_at: 'DESC' }, take: 1000 }),
      this.auditRepo.find({ order: { created_at: 'DESC' }, take: 12, relations: ['tenant', 'user'] }),
      this.deletionRepo.find({ order: { created_at: 'DESC' }, take: 8 }),
    ]);

    const completedDeposits = deposits.filter((d) => d.status === 'completed' || d.status === 'COMPLETED');
    const mrrEstimate = subs.reduce((sum, s) => sum + this.planMrr(s.plan), 0);
    const revenueTotal = completedDeposits.reduce((sum, d) => sum + parseFloat(d.amount ?? '0'), 0);

    const planDistribution: Record<string, number> = {};
    for (const s of subs) {
      planDistribution[s.plan] = (planDistribution[s.plan] ?? 0) + 1;
    }

    const aiByFunction: Record<string, number> = {};
    let aiTokensTotal = 0;
    for (const row of aiRows) {
      const tokens = parseInt(row.tokensUsed, 10) || 0;
      aiTokensTotal += tokens;
      aiByFunction[row.functionName] = (aiByFunction[row.functionName] ?? 0) + tokens;
    }

    const recentTenants = await this.tenantsRepo.find({
      order: { created_at: 'DESC' },
      take: 8,
      relations: ['owner'],
    });

    const tenantGrowth = await this.tenantsRepo
      .createQueryBuilder('t')
      .select("TO_CHAR(t.created_at, 'YYYY-MM')", 'month')
      .addSelect('COUNT(*)', 'count')
      .groupBy("TO_CHAR(t.created_at, 'YYYY-MM')")
      .orderBy('month', 'DESC')
      .limit(6)
      .getRawMany<{ month: string; count: string }>();

    return {
      company: {
        name: 'AutoPilot',
        product: 'Tekrem Innvation Solutions AutoPilot',
        tagline: 'Grow Smarter, Sell Stronger',
        description:
          'AI-powered marketing autopilot for brands — content generation, multi-platform publishing, lead capture, and comment automation.',
        operator: 'Tekrem Innvation Solutions',
        region: 'Zambia · Southern Africa',
        supportEmail: process.env.SUPPORT_EMAIL ?? 'support@agriwide.co',
        website: process.env.COMPANY_WEBSITE ?? 'https://agriwide.co',
        legal: {
          privacy: '/privacy',
          terms: '/terms',
          dataDeletion: '/data-deletion',
        },
      },
      stats: {
        tenants: tenantCount,
        users: userCount,
        activeMembers: memberCount,
        contentItems: contentCount,
        publications: publishedCount,
        connectedSocialAccounts: connectedSocial,
        leads: leadsCount,
        auditLogs: auditCount,
        commentReplies: commentCount,
        pendingDataDeletions: pendingDeletions,
        estimatedMrrZmw: mrrEstimate,
        revenueTotalZmw: revenueTotal,
        aiTokensLastPeriod: aiTokensTotal,
      },
      planDistribution,
      aiByFunction,
      tenantGrowth: tenantGrowth.reverse().map((r) => ({
        month: r.month,
        count: parseInt(r.count, 10),
      })),
      recentDeposits: deposits.slice(0, 10).map((d) => ({
        id: d.id,
        tenantId: d.tenantId,
        plan: d.plan,
        status: d.status,
        amount: d.amount,
        currency: d.currency,
        createdAt: d.created_at,
      })),
      recentTenants: recentTenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        ownerEmail: t.owner?.email,
        createdAt: t.created_at,
      })),
      recentAudit: recentAudit.map((a) => ({
        id: a.id,
        action: a.action,
        resourceType: a.resourceType,
        tenantName: (a as { tenant?: { name?: string } }).tenant?.name,
        userEmail: (a as { user?: { email?: string } }).user?.email,
        createdAt: a.created_at,
      })),
      dataDeletionRequests: deletionRequests.map((d) => ({
        id: d.id,
        platform: d.platform,
        status: d.status,
        email: d.email,
        createdAt: d.created_at,
      })),
      crons: {
        autoPublish: process.env.AUTO_PUBLISH_CRON_ENABLED !== 'false',
        dailyWorkflow: process.env.DAILY_WORKFLOW_CRON_ENABLED !== 'false',
        commentSync: process.env.COMMENT_SYNC_CRON_ENABLED !== 'false',
      },
      env: {
        nodeEnv: process.env.NODE_ENV ?? 'development',
        apiPublicUrl: process.env.API_PUBLIC_URL ?? '',
        clientUrl: process.env.CLIENT_URL ?? process.env.FRONTEND_URL ?? '',
        supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
        mistralConfigured: Boolean(process.env.MISTRAL_API_KEY),
        metaConfigured: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET),
        linkedInConfigured: Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET),
        pawapayConfigured: Boolean(process.env.PAWAPAY_API_TOKEN),
        metaWebhookTokenSet: Boolean(process.env.META_WEBHOOK_VERIFY_TOKEN),
      },
    };
  }

  async listTenants() {
    const tenants = await this.tenantsRepo.find({
      order: { created_at: 'DESC' },
      relations: ['owner'],
    });

    const subs = await this.subsRepo.find();
    const subByTenant = new Map(subs.map((s) => [s.tenantId, s]));

    const memberCounts = await this.membersRepo
      .createQueryBuilder('m')
      .select('m.tenant_id', 'tenantId')
      .addSelect('COUNT(*)', 'count')
      .where('m.is_active = true')
      .groupBy('m.tenant_id')
      .getRawMany<{ tenantId: string; count: string }>();

    const contentCounts = await this.contentRepo
      .createQueryBuilder('c')
      .select('c.tenant_id', 'tenantId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('c.tenant_id')
      .getRawMany<{ tenantId: string; count: string }>();

    const membersMap = new Map(memberCounts.map((r) => [r.tenantId, parseInt(r.count, 10)]));
    const contentMap = new Map(contentCounts.map((r) => [r.tenantId, parseInt(r.count, 10)]));

    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      ownerId: t.ownerId,
      ownerEmail: t.owner?.email,
      plan: subByTenant.get(t.id)?.plan ?? 'free',
      status: subByTenant.get(t.id)?.status ?? 'unknown',
      members: membersMap.get(t.id) ?? 0,
      contentItems: contentMap.get(t.id) ?? 0,
      createdAt: t.created_at,
    }));
  }

  async getTenantDetail(tenantId: string) {
    const tenant = await this.tenantsRepo.findOne({
      where: { id: tenantId },
      relations: ['owner'],
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const sub = await this.subsRepo.findOne({ where: { tenantId } });
    const [members, contentItems, publications, socialAccounts, leads, aiUsage] = await Promise.all([
      this.membersRepo.count({ where: { tenantId, isActive: true } }),
      this.contentRepo.count({ where: { tenantId } }),
      this.pubsRepo.count({ where: { tenantId, status: 'published' } }),
      this.socialRepo.find({ where: { tenantId } }),
      this.leadsRepo.count({ where: { tenantId } }),
      this.aiUsageRepo
        .createQueryBuilder('a')
        .select('SUM(CAST(a.tokens_used AS INTEGER))', 'total')
        .where('a.tenant_id = :tenantId', { tenantId })
        .getRawOne<{ total: string | null }>(),
    ]);

    const recentDeposits = await this.depositsRepo.find({
      where: { tenantId },
      order: { created_at: 'DESC' },
      take: 5,
    });

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      logoUrl: tenant.logoUrl,
      ownerId: tenant.ownerId,
      ownerEmail: tenant.owner?.email,
      createdAt: tenant.created_at,
      subscription: sub
        ? { plan: sub.plan, status: sub.status, billingPeriodEnd: sub.billingPeriodEnd }
        : { plan: 'free', status: 'active', billingPeriodEnd: null },
      stats: {
        members,
        contentItems,
        publications,
        leads,
        aiTokens: parseInt(aiUsage?.total ?? '0', 10) || 0,
      },
      socialAccounts: socialAccounts.map((s) => ({
        id: s.id,
        platform: s.platform,
        connected: s.connected,
        accountName: s.accountName,
      })),
      recentDeposits: recentDeposits.map((d) => ({
        id: d.id,
        plan: d.plan,
        amount: d.amount,
        currency: d.currency,
        status: d.status,
        createdAt: d.created_at,
      })),
    };
  }

  private planMrr(plan: string): number {
    switch (plan?.toLowerCase()) {
      case 'starter':
        return 375;
      case 'pro':
        return 875;
      default:
        return 0;
    }
  }
}
