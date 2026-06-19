import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentItemsService } from '../content_items/content_items.service';
import { ContentItems } from '../content_items/entities/content_items.entity';
import { AuditLogsService } from '../audit_logs/audit_logs.service';
import { MistralChatService } from '../ai/services/mistral-chat.service';
import { AiUsageTrackerService } from '../ai/services/ai-usage-tracker.service';
import { PromptBuilderService } from '../ai/services/prompt-builder.service';
import { Leads } from '../leads/entities/leads.entity';
import { ContentTemplates } from '../templates/entities/content_templates.entity';
import { KnowledgeDocument } from '../chatbot/entities/knowledge-document.entity';
import { BrandProfiles } from '../brand_profiles/entities/brand_profiles.entity';
import { brandContextBlock } from '../ai/prompts/brand-fields';

export type SearchResultType =
  | 'content'
  | 'lead'
  | 'template'
  | 'knowledge'
  | 'audit';

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle?: string;
  url: string;
}

const APP_PAGES = [
  { title: 'Dashboard', url: '/dashboard', keywords: 'home overview' },
  {
    title: 'Brand Brain',
    url: '/brand-brain',
    keywords: 'brand voice identity audience',
  },
  {
    title: 'Content Engine',
    url: '/content',
    keywords: 'create posts generate content',
  },
  {
    title: 'Scheduler',
    url: '/scheduler',
    keywords: 'schedule publish calendar',
  },
  {
    title: 'Publisher',
    url: '/publisher',
    keywords: 'connect social accounts oauth',
  },
  { title: 'Lead Agent', url: '/leads', keywords: 'leads inbox qualify' },
  { title: 'Replies', url: '/replies', keywords: 'auto reply comments' },
  { title: 'Chatbot', url: '/chatbot', keywords: 'widget assistant rag' },
  {
    title: 'Conversation Log',
    url: '/chatbot/sessions',
    keywords: 'chat transcripts sessions',
  },
  {
    title: 'Analytics',
    url: '/analytics',
    keywords: 'metrics performance stats',
  },
  { title: 'Reports', url: '/reports', keywords: 'insights export report' },
  { title: 'Media Library', url: '/media', keywords: 'images assets upload' },
  {
    title: 'Templates',
    url: '/templates',
    keywords: 'reusable content templates',
  },
  { title: 'Workspaces', url: '/workspaces', keywords: 'brands organizations' },
  {
    title: 'Approvals',
    url: '/approvals',
    keywords: 'approve content workflow',
  },
  { title: 'Team', url: '/team', keywords: 'members invite roles' },
  {
    title: 'Audit Logs',
    url: '/audit',
    keywords: 'activity history governance',
  },
  { title: 'Billing', url: '/billing', keywords: 'subscription plan payment' },
  { title: 'Settings', url: '/settings', keywords: 'preferences account' },
  { title: 'Export Data', url: '/export', keywords: 'download csv export' },
];

@Injectable()
export class SearchService {
  constructor(
    private readonly contentItems: ContentItemsService,
    private readonly auditLogs: AuditLogsService,
    private readonly mistral: MistralChatService,
    private readonly usage: AiUsageTrackerService,
    private readonly prompts: PromptBuilderService,
    @InjectRepository(Leads)
    private readonly leadsRepo: Repository<Leads>,
    @InjectRepository(ContentTemplates)
    private readonly templatesRepo: Repository<ContentTemplates>,
    @InjectRepository(KnowledgeDocument)
    private readonly knowledgeRepo: Repository<KnowledgeDocument>,
    @InjectRepository(BrandProfiles)
    private readonly brandRepo: Repository<BrandProfiles>,
  ) {}

  async query(tenantId: string, q: string, limit = 5): Promise<SearchResult[]> {
    const term = q.trim();
    if (!term) return [];

    const pattern = `%${term}%`;
    const perType = Math.min(8, Math.max(3, limit));

    const [contentPage, auditPage, leads, templates, knowledge] =
      await Promise.all([
        this.contentItems.findPaginated({
          tenantId,
          search: term,
          limit: perType,
        }),
        this.auditLogs.findFiltered({ tenantId, search: term, take: perType }),
        this.leadsRepo
          .createQueryBuilder('lead')
          .where('lead.tenantId = :tenantId', { tenantId })
          .andWhere(
            '(lead.name ILIKE :pattern OR lead.email ILIKE :pattern OR lead.message ILIKE :pattern)',
            { pattern },
          )
          .orderBy('lead.created_at', 'DESC')
          .take(perType)
          .getMany(),
        this.templatesRepo
          .createQueryBuilder('tpl')
          .where('tpl.tenantId = :tenantId', { tenantId })
          .andWhere(
            '(tpl.name ILIKE :pattern OR tpl.description ILIKE :pattern)',
            { pattern },
          )
          .orderBy('tpl.created_at', 'DESC')
          .take(perType)
          .getMany(),
        this.knowledgeRepo
          .createQueryBuilder('doc')
          .where('doc.tenantId = :tenantId', { tenantId })
          .andWhere('doc.title ILIKE :pattern', { pattern })
          .orderBy('doc.created_at', 'DESC')
          .take(perType)
          .getMany(),
      ]);

    const results: SearchResult[] = [];

    for (const raw of contentPage.items) {
      const item = raw as ContentItems;
      results.push({
        type: 'content',
        id: item.id,
        title: item.title || 'Untitled content',
        subtitle: item.status ?? undefined,
        url: `/content/${item.id}`,
      });
    }

    for (const lead of leads) {
      results.push({
        type: 'lead',
        id: lead.id,
        title: lead.name,
        subtitle: lead.email,
        url: '/leads',
      });
    }

    for (const tpl of templates) {
      results.push({
        type: 'template',
        id: tpl.id,
        title: tpl.name,
        subtitle: tpl.contentType ?? undefined,
        url: '/templates',
      });
    }

    for (const doc of knowledge) {
      results.push({
        type: 'knowledge',
        id: doc.id,
        title: doc.title,
        subtitle: doc.status,
        url: '/chatbot/knowledge',
      });
    }

    for (const log of auditPage.items) {
      const action = String(log.action ?? 'Audit event');
      results.push({
        type: 'audit',
        id: String(log.id ?? action),
        title: action,
        subtitle: log.resourceType ? String(log.resourceType) : undefined,
        url: '/audit',
      });
    }

    return results.slice(0, limit * 2);
  }

  async ask(
    tenantId: string,
    userId: string,
    q: string,
  ): Promise<{ answer: string; links: Array<{ title: string; url: string }> }> {
    await this.usage.assertWithinLimit(tenantId, userId);

    const term = q.trim();
    const [searchResults, brandProfile] = await Promise.all([
      this.query(tenantId, term, 6),
      this.brandRepo.findOne({ where: { tenantId } }),
    ]);

    const brandCtx = this.prompts.brandFromEntity(brandProfile);
    const brandBlock = brandProfile
      ? brandContextBlock(brandCtx)
      : 'No brand profile configured.';

    const pageHints = APP_PAGES.filter((p) => {
      const hay = `${p.title} ${p.keywords}`.toLowerCase();
      const words = term.toLowerCase().split(/\s+/).filter(Boolean);
      return words.some((w) => hay.includes(w));
    }).slice(0, 6);

    const contextBlock = [
      `Brand profile:\n${brandBlock}`,
      pageHints.length
        ? `Relevant app pages:\n${pageHints
            .map((p) => `- ${p.title}: ${p.url}`)
            .join('\n')}`
        : '',
      searchResults.length
        ? `Matching workspace records:\n${searchResults
            .map(
              (r) =>
                `- [${r.type}] ${r.title}${
                  r.subtitle ? ` (${r.subtitle})` : ''
                } → ${r.url}`,
            )
            .join('\n')}`
        : 'No matching records in this workspace for this query.',
      `App pages catalog:\n${APP_PAGES.map(
        (p) => `- ${p.title}: ${p.url}`,
      ).join('\n')}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const { data, tokensUsed } = await this.mistral.completeJson<{
      answer: string;
      links?: Array<{ title: string; url: string }>;
    }>(
      [
        {
          role: 'system',
          content: `You are Mako's in-app assistant. Help users navigate the marketing platform and find their content, leads, and settings.
Answer concisely in plain language (2–5 sentences unless the user asks for detail).
When suggesting navigation, include deep links from the context.
Return ONLY JSON: { "answer": "...", "links": [{ "title": "...", "url": "/path" }] }
Use relative paths starting with /. Include 0–4 links when helpful.`,
        },
        {
          role: 'user',
          content: `User question: ${term}\n\nContext:\n${contextBlock}`,
        },
      ],
      { model: this.mistral.defaultModel },
    );

    await this.usage.record({
      tenantId,
      userId,
      functionName: 'global-search-ask',
      tokensUsed,
    });

    const links = Array.isArray(data.links)
      ? data.links
          .filter((l) => l?.title && l?.url?.startsWith('/'))
          .slice(0, 4)
      : [];

    return {
      answer:
        String(data.answer ?? '').trim() ||
        'I could not find an answer. Try rephrasing or use search to browse records.',
      links,
    };
  }
}
