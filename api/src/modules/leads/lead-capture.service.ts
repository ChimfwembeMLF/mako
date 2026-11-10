import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Leads } from './entities/leads.entity';
import { Tenants } from '../tenants/entities/tenants.entity';
import { LeadClassifyService } from './services/lead-classify.service';
import { worthClassifying } from './lead-signal';

/** Where a captured lead first reached the business. Shown on the Leads page. */
export type LeadChannel =
  | 'instagram_dm'
  | 'facebook_dm'
  | 'x_dm'
  | 'instagram_comment'
  | 'facebook_comment'
  | 'linkedin_comment'
  | 'youtube_comment'
  | 'tiktok_comment'
  | 'x_reply'
  | 'email';

const PLACEHOLDER_NAME = / (user|contact)$/i;

export type CaptureInput = {
  tenantId: string;
  workspaceId?: string | null;
  source: LeadChannel;
  /**
   * Who this person is on that channel, e.g. "instagram:1784…" or "email:jo@x.com".
   * One person on one channel is one lead; each new message updates it.
   */
  externalRef: string;
  /** A second key to look under (e.g. a comment name before ids were stored). */
  fallbackRef?: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  message: string;
  at?: Date;
  /** Ask the AI to label the lead (default). Off for bulk imports, to keep AI costs down. */
  classify?: boolean;
};

export type ImportResult = { created: number; updated: number };

/** Platform names as people know them, for default lead names. */
const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  x: 'X',
  twitter: 'X',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  tiktok: 'TikTok',
};

export function platformLabel(platform: string): string {
  return PLATFORM_LABEL[platform?.toLowerCase()] ?? platform;
}

export function dmSource(platform: string): LeadChannel | null {
  const p = platform?.toLowerCase();
  if (p === 'instagram') return 'instagram_dm';
  if (p === 'facebook') return 'facebook_dm';
  if (p === 'x' || p === 'twitter') return 'x_dm';
  return null;
}

export function commentSource(platform: string): LeadChannel | null {
  const p = platform?.toLowerCase();
  if (p === 'instagram') return 'instagram_comment';
  if (p === 'facebook') return 'facebook_comment';
  if (p === 'linkedin') return 'linkedin_comment';
  if (p === 'youtube') return 'youtube_comment';
  if (p === 'tiktok') return 'tiktok_comment';
  if (p === 'x' || p === 'twitter') return 'x_reply';
  return null;
}

/**
 * Turns everyone who writes to the business (direct messages, comments, emails) into a
 * lead. Never throws: a failed capture must not stop the message itself being saved.
 */
@Injectable()
export class LeadCaptureService {
  private readonly logger = new Logger(LeadCaptureService.name);
  private readonly classifiedAt = new Map<string, number>();
  private readonly owners = new Map<string, { id: string | null; at: number }>();

  constructor(
    @InjectRepository(Leads)
    private readonly leads: Repository<Leads>,
    @InjectRepository(Tenants)
    private readonly tenants: Repository<Tenants>,
    private readonly classify: LeadClassifyService,
  ) {}

  async capture(input: CaptureInput): Promise<Leads | null> {
    try {
      return (await this.upsert(input))?.lead ?? null;
    } catch (err) {
      this.logger.warn(
        `Lead capture skipped (${input.source}): ${
          err instanceof Error ? err.message : err
        }`,
      );
      return null;
    }
  }

  private async ownerOf(tenantId: string): Promise<string | null> {
    const hit = this.owners.get(tenantId);
    if (hit && Date.now() - hit.at < 10 * 60_000) return hit.id;
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    const id = tenant?.ownerId ?? null;
    this.owners.set(tenantId, { id, at: Date.now() });
    return id;
  }

  private async find(tenantId: string, workspaceId: string | null | undefined, ref: string) {
    return this.leads.findOne({
      where: {
        tenantId,
        workspaceId: workspaceId ?? IsNull(),
        externalRef: ref,
      },
    });
  }

  private async upsert(
    input: CaptureInput,
  ): Promise<{ lead: Leads; created: boolean } | null> {
    const message = input.message.trim();
    if (!message || !input.externalRef) return null;
    const userId = await this.ownerOf(input.tenantId);
    if (!userId) return null;

    const name = input.name?.trim() || null;
    const email = input.email?.trim().toLowerCase() || null;
    const at = input.at ?? new Date();

    let lead = await this.find(input.tenantId, input.workspaceId, input.externalRef);
    if (!lead && input.fallbackRef) {
      lead = await this.find(input.tenantId, input.workspaceId, input.fallbackRef);
      if (lead) lead.externalRef = input.externalRef;
    }
    // Someone who already filled in a form (or emailed before) stays one lead.
    if (!lead && email) {
      lead = await this.leads.findOne({ where: { tenantId: input.tenantId, email } });
      if (lead && !lead.externalRef) lead.externalRef = input.externalRef;
    }

    const created = !lead;
    if (lead) {
      // Older messages (from a sync) don't replace the newest one.
      if (!lead.lastMessageAt || at >= lead.lastMessageAt) {
        lead.message = message;
        lead.lastMessageAt = at;
      }
      if (name && (!lead.name || PLACEHOLDER_NAME.test(lead.name))) lead.name = name;
      if (input.avatarUrl && !lead.avatarUrl) lead.avatarUrl = input.avatarUrl;
      if (email && !lead.email) lead.email = email;
      if (lead.status === 'closed') lead.status = 'open';
      lead = await this.leads.save(lead);
    } else {
      const platform = input.source.split('_')[0];
      lead = await this.leads.save(
        this.leads.create({
          tenantId: input.tenantId,
          workspaceId: input.workspaceId ?? undefined,
          userId,
          name: name ?? email ?? `${platformLabel(platform)} user`,
          email: email ?? '',
          source: input.source,
          externalRef: input.externalRef,
          avatarUrl: input.avatarUrl ?? undefined,
          message,
          lastMessageAt: at,
          status: 'new',
          classification: 'inbound',
        }),
      );
    }

    if (input.classify !== false) this.maybeClassify(lead, message, userId);
    return { lead, created };
  }

  /**
   * Adds everyone who has already messaged, commented or emailed. Safe to run again:
   * people who are already leads are updated, not duplicated.
   */
  async importExisting(tenantId: string, workspaceId?: string | null): Promise<ImportResult> {
    const result: ImportResult = { created: 0, updated: 0 };
    const add = async (input: CaptureInput) => {
      try {
        const r = await this.upsert({ ...input, classify: false });
        if (r) result[r.created ? 'created' : 'updated']++;
      } catch (err) {
        this.logger.warn(`Lead import skipped one: ${err instanceof Error ? err.message : err}`);
      }
    };
    const ws = workspaceId ?? null;
    const q = (sql: string) => this.leads.manager.query(sql, [tenantId, ws]);

    // Direct messages: one row per person, with their latest message.
    const dms: Array<{
      workspace_id: string | null; platform: string; participant_id: string;
      name: string | null; body: string; at: Date; all_posts: boolean;
    }> = await q(`
      SELECT workspace_id, platform, participant_id,
             (array_agg(participant_name ORDER BY created_at DESC) FILTER (WHERE participant_name IS NOT NULL))[1] AS name,
             (array_agg(body ORDER BY created_at DESC))[1] AS body,
             max(created_at) AS at,
             bool_and(thread_id LIKE 'post:%') AS all_posts
        FROM social_messages
       WHERE tenant_id = $1 AND direction = 'inbound'
         AND ($2::uuid IS NULL OR workspace_id = $2::uuid)
       GROUP BY workspace_id, platform, participant_id`);
    for (const d of dms) {
      const isX = d.platform === 'x' || d.platform === 'twitter';
      const source = isX && d.all_posts ? 'x_reply' : dmSource(d.platform);
      if (!source) continue;
      await add({
        tenantId,
        workspaceId: d.workspace_id,
        source,
        externalRef: `${isX ? 'x' : d.platform}:${d.participant_id}`,
        name: d.name,
        message: d.body,
        at: new Date(d.at),
      });
    }

    // Comments (not the brand's own replies).
    const comments: Array<{
      workspace_id: string | null; platform: string; commenter_id: string | null;
      name: string; avatar: string | null; body: string; at: Date;
    }> = await q(`
      SELECT c.workspace_id, r.platform, r.commenter_id,
             (array_agg(r.commenter_name ORDER BY r.created_at DESC))[1] AS name,
             (array_agg(r.commenter_avatar_url ORDER BY r.created_at DESC) FILTER (WHERE r.commenter_avatar_url IS NOT NULL))[1] AS avatar,
             (array_agg(r.comment_text ORDER BY r.created_at DESC))[1] AS body,
             max(r.created_at) AS at
        FROM comment_replies r
        JOIN content_items c ON c.id = r.content_id
       WHERE r.tenant_id = $1 AND r.is_from_brand = false
         AND ($2::uuid IS NULL OR c.workspace_id = $2::uuid)
       GROUP BY c.workspace_id, r.platform, r.commenter_id,
                CASE WHEN r.commenter_id IS NULL THEN lower(r.commenter_name) END`);
    for (const c of comments) {
      const source = commentSource(c.platform);
      if (!source) continue;
      const platform = c.platform === 'twitter' ? 'x' : c.platform;
      const nameRef = `${platform}:name:${c.name.trim().toLowerCase()}`;
      await add({
        tenantId,
        workspaceId: c.workspace_id,
        source,
        externalRef: c.commenter_id ? `${platform}:${c.commenter_id}` : nameRef,
        fallbackRef: c.commenter_id ? nameRef : undefined,
        name: c.name,
        avatarUrl: c.avatar,
        message: c.body,
        at: new Date(c.at),
      });
    }

    // Emails from real people (newsletters and no-reply senders were marked skipped).
    const emails: Array<{ workspace_id: string | null; email: string; subject: string | null; body: string; at: Date }> =
      await q(`
      SELECT workspace_id, lower(from_email) AS email,
             (array_agg(subject ORDER BY created_at DESC))[1] AS subject,
             (array_agg(body ORDER BY created_at DESC))[1] AS body,
             max(created_at) AS at
        FROM mail_messages
       WHERE tenant_id = $1 AND direction = 'inbound' AND status <> 'skipped'
         AND ($2::uuid IS NULL OR workspace_id = $2::uuid)
       GROUP BY workspace_id, lower(from_email)`);
    for (const e of emails) {
      await add({
        tenantId,
        workspaceId: e.workspace_id,
        source: 'email',
        externalRef: `email:${e.email}`,
        email: e.email,
        message: [e.subject, e.body].filter(Boolean).join('\n\n').slice(0, 4000),
        at: new Date(e.at),
      });
    }

    return result;
  }

  private maybeClassify(lead: Leads, message: string, userId: string) {
    if (!worthClassifying(message, lead, this.classifiedAt.get(lead.id))) return;
    this.classifiedAt.set(lead.id, Date.now());
    if (this.classifiedAt.size > 10_000) this.classifiedAt.clear();

    void this.classify
      .classify({
        tenantId: lead.tenantId,
        userId,
        name: lead.name,
        email: lead.email || lead.source,
        message,
      })
      .then(async (result) => {
        if (result?.label) {
          await this.leads.update(lead.id, {
            classification: result.label,
            aiReply: result.suggestedReply || undefined,
          });
        }
      })
      .catch((err) =>
        this.logger.debug(`Lead classify skipped: ${err instanceof Error ? err.message : err}`),
      );
  }
}
