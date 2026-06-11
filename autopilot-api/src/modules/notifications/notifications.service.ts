import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, Between, IsNull } from 'typeorm';
import { Notifications } from './entities/notifications.entity';
import { NotificationPreferences } from './entities/notification_preferences.entity';
import { UserEntity } from '../user/user.entity';
import { TenantMembers } from '../tenant_members/entities/tenant_members.entity';
import { TenantSubscriptions } from '../subscriptions/entities/tenant_subscriptions.entity';
import { MailService } from '../mail/mail.service';
import { QueueDispatchService } from '../queues/queue-dispatch.service';
import { ContentPublications } from '../content_publications/entities/content_publications.entity';
import { CommentReplies } from '../comment_replies/entities/comment_replies.entity';
import { Leads } from '../leads/entities/leads.entity';
import { ContentItems } from '../content_items/entities/content_items.entity';
import { AiUsage } from '../ai_usage/entities/ai_usage.entity';
import { Deposits } from '../deposits/entities/deposits.entity';
import { ChatSession } from '../chatbot/entities/chat-session.entity';
import { ChatMessage } from '../chatbot/entities/chat-message.entity';
import { KnowledgeDocument } from '../chatbot/entities/knowledge-document.entity';
import { ChatbotConfig } from '../chatbot/entities/chatbot-config.entity';
import { ChatbotApiKey } from '../chatbot/entities/chatbot-api-key.entity';
import { REPORT_CATALOG } from './report-catalog';
import {
  ReportExportFormat,
  reportDataToSections,
  reportExportFilename,
  reportExportMime,
  reportTitle,
  renderReportCsv,
  renderReportPdf,
  renderReportXlsx,
} from './report-export.util';

export { REPORT_CATALOG } from './report-catalog';

export type NotificationType =
  | 'publish_success'
  | 'publish_failed'
  | 'publish_queued'
  | 'billing_payment'
  | 'subscription_ending'
  | 'weekly_digest'
  | 'hot_lead'
  | 'comment_pending';

export type NotifyInput = {
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  metadata?: Record<string, unknown>;
  email?: boolean;
  emailCategory?: keyof Pick<
    NotificationPreferences,
    'emailPublishSuccess' | 'emailBilling' | 'emailWeeklyDigest' | 'emailHotLeads'
  >;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notifications)
    private readonly notificationsRepo: Repository<Notifications>,
    @InjectRepository(NotificationPreferences)
    private readonly prefsRepo: Repository<NotificationPreferences>,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    @InjectRepository(TenantMembers)
    private readonly membersRepo: Repository<TenantMembers>,
    @InjectRepository(TenantSubscriptions)
    private readonly subsRepo: Repository<TenantSubscriptions>,
    @InjectRepository(ContentPublications)
    private readonly pubsRepo: Repository<ContentPublications>,
    @InjectRepository(CommentReplies)
    private readonly commentsRepo: Repository<CommentReplies>,
    @InjectRepository(Leads)
    private readonly leadsRepo: Repository<Leads>,
    @InjectRepository(ContentItems)
    private readonly contentRepo: Repository<ContentItems>,
    @InjectRepository(AiUsage)
    private readonly aiUsageRepo: Repository<AiUsage>,
    @InjectRepository(Deposits)
    private readonly depositsRepo: Repository<Deposits>,
    @InjectRepository(ChatSession)
    private readonly chatSessionRepo: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private readonly chatMessageRepo: Repository<ChatMessage>,
    @InjectRepository(KnowledgeDocument)
    private readonly knowledgeDocRepo: Repository<KnowledgeDocument>,
    @InjectRepository(ChatbotConfig)
    private readonly chatbotConfigRepo: Repository<ChatbotConfig>,
    @InjectRepository(ChatbotApiKey)
    private readonly chatbotKeyRepo: Repository<ChatbotApiKey>,
    private readonly mail: MailService,
    @Optional() private readonly queueDispatch?: QueueDispatchService,
  ) {}

  async notify(input: NotifyInput): Promise<Notifications | null> {
    const prefs = await this.getPreferences(input.userId, input.tenantId);
    if (!prefs.inAppEnabled && !input.email) return null;

    let row: Notifications | null = null;
    if (prefs.inAppEnabled) {
      row = await this.notificationsRepo.save(
        this.notificationsRepo.create({
          tenantId: input.tenantId,
          userId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body,
          link: input.link,
          metadata: input.metadata,
          read: false,
          emailSent: false,
        }),
      );
    }

    if (input.email && input.emailCategory && prefs[input.emailCategory]) {
      await this.sendEmailToUser(input.userId, input.title, input.body, row?.id);
    }

    return row;
  }

  async notifyTenantAdmins(
    tenantId: string,
    input: Omit<NotifyInput, 'tenantId' | 'userId'>,
  ): Promise<void> {
    const members = await this.membersRepo.find({ where: { tenantId } });
    const userIds = [...new Set(members.map((m) => m.userId))];
    for (const userId of userIds) {
      await this.notify({ ...input, tenantId, userId });
    }
  }

  async listForUser(
    userId: string,
    tenantId: string,
    opts?: { unreadOnly?: boolean; limit?: number },
  ) {
    const where: Record<string, unknown> = { userId, tenantId };
    if (opts?.unreadOnly) where.read = false;
    return this.notificationsRepo.find({
      where,
      order: { created_at: 'DESC' },
      take: opts?.limit ?? 50,
    });
  }

  async unreadCount(userId: string, tenantId: string): Promise<number> {
    return this.notificationsRepo.count({
      where: { userId, tenantId, read: false },
    });
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    await this.notificationsRepo.update(
      { id: notificationId, userId },
      { read: true },
    );
  }

  async markAllRead(userId: string, tenantId: string): Promise<void> {
    await this.notificationsRepo.update(
      { userId, tenantId, read: false },
      { read: true },
    );
  }

  async getPreferences(userId: string, tenantId: string): Promise<NotificationPreferences> {
    let prefs = await this.prefsRepo.findOne({ where: { userId, tenantId } });
    if (!prefs) {
      prefs = await this.prefsRepo.save(
        this.prefsRepo.create({ userId, tenantId }),
      );
    }
    return prefs;
  }

  async updatePreferences(
    userId: string,
    tenantId: string,
    patch: Partial<
      Pick<
        NotificationPreferences,
        | 'emailPublishSuccess'
        | 'emailBilling'
        | 'emailWeeklyDigest'
        | 'emailHotLeads'
        | 'inAppEnabled'
      >
    >,
  ): Promise<NotificationPreferences> {
    const prefs = await this.getPreferences(userId, tenantId);
    Object.assign(prefs, patch);
    return this.prefsRepo.save(prefs);
  }

  async notifyPublishSuccess(params: {
    tenantId: string;
    userId: string;
    contentId: string;
    title?: string;
    platforms: string[];
  }): Promise<void> {
    const platformList = params.platforms.join(', ');
    await this.notify({
      tenantId: params.tenantId,
      userId: params.userId,
      type: 'publish_success',
      title: 'Content published',
      body: `"${params.title ?? 'Your post'}" was published to ${platformList}.`,
      link: `/content/${params.contentId}`,
      metadata: { contentId: params.contentId, platforms: params.platforms },
      email: true,
      emailCategory: 'emailPublishSuccess',
    });
  }

  async notifyPublishFailed(params: {
    tenantId: string;
    userId: string;
    contentId: string;
    title?: string;
    reason: string;
  }): Promise<void> {
    await this.notify({
      tenantId: params.tenantId,
      userId: params.userId,
      type: 'publish_failed',
      title: 'Publish failed',
      body: `"${params.title ?? 'Your post'}" could not be published. ${params.reason}`,
      link: `/content/${params.contentId}`,
      metadata: { contentId: params.contentId },
      email: true,
      emailCategory: 'emailPublishSuccess',
    });
  }

  async notifyPaymentSuccess(params: {
    tenantId: string;
    plan: string;
    amount?: number;
  }): Promise<void> {
    await this.notifyTenantAdmins(params.tenantId, {
      type: 'billing_payment',
      title: 'Payment received',
      body: `Your ${params.plan} plan is now active${params.amount ? ` (ZMW ${params.amount})` : ''}.`,
      link: '/billing',
      metadata: { plan: params.plan },
      email: true,
      emailCategory: 'emailBilling',
    });
  }

  async checkSubscriptionEndingSoon(): Promise<number> {
    const now = new Date();
    const inSevenDays = new Date(now);
    inSevenDays.setDate(inSevenDays.getDate() + 7);

    const subs = await this.subsRepo.find({
      where: {
        status: 'active',
        billingPeriodEnd: Between(now, inSevenDays),
      },
    });

    let sent = 0;
    for (const sub of subs) {
      const daysLeft = Math.ceil(
        (sub.billingPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      await this.notifyTenantAdmins(sub.tenantId, {
        type: 'subscription_ending',
        title: 'Subscription ending soon',
        body: `Your billing period ends in ${daysLeft} day(s). Renew on the Billing page to avoid interruption.`,
        link: '/billing',
        metadata: { daysLeft, plan: sub.plan },
        email: true,
        emailCategory: 'emailBilling',
      });
      sent++;
    }
    return sent;
  }

  async sendWeeklyDigests(): Promise<number> {
    const tenantIds = await this.subsRepo
      .find({ where: { status: 'active' } })
      .then((rows) => rows.map((r) => r.tenantId));

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    let sent = 0;
    for (const tenantId of tenantIds) {
      const members = await this.membersRepo.find({ where: { tenantId } });
      const pubs = await this.pubsRepo.find({
        where: { tenantId, status: 'published' },
      });
      const recentPubs = pubs.filter(
        (p) => p.publishedAt && new Date(p.publishedAt) >= weekAgo,
      );
      const totalEngagement = recentPubs.reduce(
        (s, p) => s + (p.engagementScore ?? 0),
        0,
      );
      const pendingComments = await this.commentsRepo.count({
        where: { tenantId, status: 'pending' },
      });
      const newLeads = await this.leadsRepo.count({
        where: { tenantId, created_at: MoreThanOrEqual(weekAgo) },
      });

      const body = [
        `Published: ${recentPubs.length} post(s)`,
        `Engagement score: ${totalEngagement}`,
        `Pending comment replies: ${pendingComments}`,
        `New leads: ${newLeads}`,
        '',
        'View full analytics in your dashboard.',
      ].join('\n');

      for (const member of members) {
        const prefs = await this.getPreferences(member.userId, tenantId);
        if (!prefs.emailWeeklyDigest && !prefs.inAppEnabled) continue;

        await this.notify({
          tenantId,
          userId: member.userId,
          type: 'weekly_digest',
          title: 'Your weekly content overview',
          body,
          link: '/analytics',
          metadata: {
            published: recentPubs.length,
            engagement: totalEngagement,
            pendingComments,
            newLeads,
          },
          email: prefs.emailWeeklyDigest,
          emailCategory: 'emailWeeklyDigest',
        });
      }
      sent++;
    }
    return sent;
  }

  listReportCatalog() {
    return REPORT_CATALOG;
  }

  async exportReport(
    tenantId: string,
    reportId: string,
    format: ReportExportFormat,
  ): Promise<{ buffer: Buffer; filename: string; mime: string }> {
    const data = await this.generateReport(tenantId, reportId);
    const title = reportTitle(reportId);
    const sections = reportDataToSections(data, title);

    let buffer: Buffer;
    switch (format) {
      case 'csv':
        buffer = renderReportCsv(sections, title);
        break;
      case 'xlsx':
        buffer = await renderReportXlsx(sections, title);
        break;
      case 'pdf':
        buffer = await renderReportPdf(sections, title);
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    return {
      buffer,
      filename: reportExportFilename(reportId, format),
      mime: reportExportMime(format),
    };
  }

  async generateReport(tenantId: string, reportId: string) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    switch (reportId) {
      case 'content-performance': {
        const pubs = await this.pubsRepo.find({
          where: { tenantId, status: 'published' },
          order: { engagementScore: 'DESC' },
          take: 20,
        });
        return {
          reportId,
          generatedAt: new Date().toISOString(),
          rows: pubs.map((p) => ({
            platform: p.platform,
            contentId: p.contentId,
            likes: p.likeCount,
            comments: p.commentCount,
            shares: p.shareCount,
            views: p.viewCount,
            score: p.engagementScore,
            publishedAt: p.publishedAt,
          })),
        };
      }
      case 'engagement-weekly': {
        const pubs = await this.pubsRepo.find({
          where: { tenantId, status: 'published' },
        });
        const thisWeek = pubs.filter(
          (p) => p.publishedAt && new Date(p.publishedAt) >= weekAgo,
        );
        const prevStart = new Date(weekAgo);
        prevStart.setDate(prevStart.getDate() - 7);
        const lastWeek = pubs.filter((p) => {
          if (!p.publishedAt) return false;
          const d = new Date(p.publishedAt);
          return d >= prevStart && d < weekAgo;
        });
        const sum = (list: ContentPublications[]) =>
          list.reduce((s, p) => s + (p.engagementScore ?? 0), 0);
        return {
          reportId,
          generatedAt: new Date().toISOString(),
          thisWeek: { posts: thisWeek.length, engagement: sum(thisWeek) },
          lastWeek: { posts: lastWeek.length, engagement: sum(lastWeek) },
        };
      }
      case 'publishing-activity': {
        const items = await this.contentRepo.find({ where: { tenantId } });
        const byStatus: Record<string, number> = {};
        const byPlatform: Record<string, number> = {};
        for (const item of items) {
          byStatus[item.status ?? 'draft'] = (byStatus[item.status ?? 'draft'] ?? 0) + 1;
          for (const p of item.platforms ?? []) {
            byPlatform[p] = (byPlatform[p] ?? 0) + 1;
          }
        }
        return { reportId, generatedAt: new Date().toISOString(), byStatus, byPlatform };
      }
      case 'lead-pipeline': {
        const leads = await this.leadsRepo.find({ where: { tenantId } });
        const counts = { hot: 0, warm: 0, cold: 0, other: 0 };
        for (const l of leads) {
          const tier = (l.classification ?? 'other').toLowerCase();
          if (tier in counts) counts[tier as keyof typeof counts]++;
          else counts.other++;
        }
        return { reportId, generatedAt: new Date().toISOString(), counts, total: leads.length };
      }
      case 'ai-usage': {
        const sub = await this.subsRepo.findOne({ where: { tenantId } });
        const from = sub?.billingPeriodStart ?? weekAgo;
        const to = sub?.billingPeriodEnd ?? new Date();
        const usage = await this.aiUsageRepo.find({
          where: { tenantId, created_at: Between(from, to) },
        });
        const byFunction: Record<string, number> = {};
        for (const u of usage) {
          byFunction[u.functionName] = (byFunction[u.functionName] ?? 0) + 1;
        }
        return {
          reportId,
          generatedAt: new Date().toISOString(),
          totalCalls: usage.length,
          byFunction,
          billingPeriod: { from, to },
          plan: sub?.plan ?? 'free',
        };
      }
      case 'subscription-billing': {
        const sub = await this.subsRepo.findOne({ where: { tenantId } });
        const deposits = await this.depositsRepo.find({
          where: { tenantId },
          order: { created_at: 'DESC' },
          take: 10,
        });
        return {
          reportId,
          generatedAt: new Date().toISOString(),
          subscription: sub,
          recentPayments: deposits.map((d) => ({
            depositId: d.depositId,
            plan: d.plan,
            status: d.status,
            amount: d.amount,
            created_at: d.created_at,
          })),
        };
      }
      case 'comment-inbox': {
        const pending = await this.commentsRepo.count({
          where: { tenantId, status: 'pending' },
        });
        const sent = await this.commentsRepo.count({
          where: { tenantId, status: 'sent' },
        });
        const weekComments = await this.commentsRepo.count({
          where: { tenantId, created_at: MoreThanOrEqual(weekAgo) },
        });
        return {
          reportId,
          generatedAt: new Date().toISOString(),
          pending,
          sent,
          newThisWeek: weekComments,
        };
      }
      case 'chatbot-conversations': {
        const sessions = await this.chatSessionRepo.find({
          where: { tenantId },
          order: { lastMessageAt: 'DESC', created_at: 'DESC' },
          take: 50,
        });
        const channelRows = await this.chatSessionRepo
          .createQueryBuilder('s')
          .select('s.channel', 'channel')
          .addSelect('COUNT(*)', 'count')
          .where('s.tenant_id = :tenantId', { tenantId })
          .groupBy('s.channel')
          .getRawMany<{ channel: string; count: string }>();
        const byChannel = Object.fromEntries(
          channelRows.map((r) => [r.channel, parseInt(r.count, 10)]),
        );
        const totalSessions = await this.chatSessionRepo.count({ where: { tenantId } });
        const totalMessages = await this.chatMessageRepo.count({ where: { tenantId } });
        const weekSessions = await this.chatSessionRepo.count({
          where: { tenantId, created_at: MoreThanOrEqual(weekAgo) },
        });
        const config = await this.chatbotConfigRepo.findOne({
          where: { tenantId },
          order: { created_at: 'ASC' },
        });
        return {
          reportId,
          generatedAt: new Date().toISOString(),
          botName: config?.name ?? 'Website Assistant',
          widgetEnabled: config?.widgetEnabled ?? false,
          totalSessions,
          sessionsThisWeek: weekSessions,
          totalMessages,
          byChannel,
          recentSessions: sessions.slice(0, 20).map((s) => ({
            id: s.id,
            channel: s.channel,
            title: s.title,
            lastMessageAt: s.lastMessageAt,
            createdAt: s.created_at,
          })),
        };
      }
      case 'chatbot-knowledge': {
        const docs = await this.knowledgeDocRepo.find({
          where: { tenantId },
          order: { created_at: 'DESC' },
        });
        const byStatus: Record<string, number> = {};
        let totalChunks = 0;
        for (const d of docs) {
          byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
          totalChunks += d.chunkCount ?? 0;
        }
        const config = await this.chatbotConfigRepo.findOne({
          where: { tenantId },
          order: { created_at: 'ASC' },
        });
        return {
          reportId,
          generatedAt: new Date().toISOString(),
          ragEnabled: config?.ragEnabled ?? true,
          useMistralLibrary: config?.useMistralLibrary ?? false,
          totalDocuments: docs.length,
          totalChunks,
          byStatus,
          documents: docs.map((d) => ({
            id: d.id,
            title: d.title,
            status: d.status,
            chunkCount: d.chunkCount,
            mimeType: d.mimeType,
            errorMessage: d.errorMessage,
            createdAt: d.created_at,
          })),
        };
      }
      case 'chatbot-ai-usage': {
        const sub = await this.subsRepo.findOne({ where: { tenantId } });
        const from = sub?.billingPeriodStart ?? weekAgo;
        const to = sub?.billingPeriodEnd ?? new Date();
        const usage = await this.aiUsageRepo.find({
          where: { tenantId, created_at: Between(from, to) },
        });
        const chatbotFunctions = ['chatbot-message', 'ingest-document'];
        const chatbotUsage = usage.filter((u) => chatbotFunctions.includes(u.functionName));
        const byFunction: Record<string, { calls: number; tokens: number }> = {};
        for (const u of chatbotUsage) {
          const cur = byFunction[u.functionName] ?? { calls: 0, tokens: 0 };
          cur.calls += 1;
          cur.tokens += parseInt(u.tokensUsed, 10) || 0;
          byFunction[u.functionName] = cur;
        }
        const activeKeys = await this.chatbotKeyRepo.count({
          where: { tenantId, revokedAt: IsNull() },
        });
        const config = await this.chatbotConfigRepo.findOne({
          where: { tenantId },
          order: { created_at: 'ASC' },
        });
        return {
          reportId,
          generatedAt: new Date().toISOString(),
          billingPeriod: { from, to },
          widgetEnabled: config?.widgetEnabled ?? false,
          activeApiKeys: activeKeys,
          totalCalls: chatbotUsage.length,
          totalTokens: chatbotUsage.reduce(
            (sum, u) => sum + (parseInt(u.tokensUsed, 10) || 0),
            0,
          ),
          byFunction,
        };
      }
      default:
        return { reportId, error: 'Unknown report type' };
    }
  }

  private async sendEmailToUser(
    userId: string,
    subject: string,
    body: string,
    notificationId?: string,
  ): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user?.email) return;

    const text = `${body}\n\n— Mako Co-pilot`;
    if (this.queueDispatch?.isEnabled()) {
      await this.queueDispatch.enqueueEmail({
        to: user.email,
        subject,
        body: text,
      });
    } else {
      await this.mail.sendGenericEmail(user.email, subject, text);
    }

    if (notificationId) {
      await this.notificationsRepo.update(notificationId, { emailSent: true });
    }
  }
}
