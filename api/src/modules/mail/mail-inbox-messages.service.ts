import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MailMessages } from './entities/mail_messages.entity';
import { sanitizeInboundEmailBody } from './email-reply.util';

export type MailDraftListItem = {
  id: string;
  toEmail: string;
  subject: string | null;
  body: string;
  status: string;
  threadId: string | null;
  gmailDraftId: string | null;
  inReplyToGmailMessageId: string | null;
  ruleId: string | null;
  createdAt: string;
  gmailThreadUrl: string | null;
  gmailDraftsUrl: string;
};

export type MailInboundListItem = {
  id: string;
  gmailMessageId: string;
  fromEmail: string;
  subject: string | null;
  body: string;
  status: string;
  threadId: string | null;
  ruleId: string | null;
  createdAt: string;
  gmailThreadUrl: string | null;
  hasDraft: boolean;
  draftId: string | null;
};

@Injectable()
export class MailInboxMessagesService {
  constructor(
    @InjectRepository(MailMessages)
    private readonly mailMessagesRepo: Repository<MailMessages>,
  ) {}

  async listInboundMessages(params: {
    tenantId: string;
    userId: string;
    workspaceId?: string;
    limit?: number;
  }): Promise<MailInboundListItem[]> {
    const qb = this.mailMessagesRepo
      .createQueryBuilder('m')
      .where('m.tenantId = :tenantId', { tenantId: params.tenantId })
      .andWhere('m.userId = :userId', { userId: params.userId })
      .andWhere('m.direction = :direction', { direction: 'inbound' })
      .orderBy('m.created_at', 'DESC')
      .take(Math.min(params.limit ?? 50, 100));

    if (params.workspaceId) {
      qb.andWhere('(m.workspaceId = :workspaceId OR m.workspaceId IS NULL)', {
        workspaceId: params.workspaceId,
      });
    }

    const rows = await qb.getMany();
    const draftByInbound = await this.loadDraftsByInboundId(rows);

    return rows.map((row) => this.toInboundListItem(row, draftByInbound));
  }

  async listDraftReplies(params: {
    tenantId: string;
    userId: string;
    workspaceId?: string;
    limit?: number;
  }): Promise<MailDraftListItem[]> {
    const qb = this.mailMessagesRepo
      .createQueryBuilder('m')
      .where('m.tenantId = :tenantId', { tenantId: params.tenantId })
      .andWhere('m.userId = :userId', { userId: params.userId })
      .andWhere('m.direction = :direction', { direction: 'outbound' })
      .andWhere('m.status = :status', { status: 'draft' })
      .orderBy('m.created_at', 'DESC')
      .take(Math.min(params.limit ?? 50, 100));

    if (params.workspaceId) {
      qb.andWhere('(m.workspaceId = :workspaceId OR m.workspaceId IS NULL)', {
        workspaceId: params.workspaceId,
      });
    }

    const rows = await qb.getMany();
    return rows.map((row) => this.toDraftListItem(row));
  }

  private async loadDraftsByInboundId(
    inboundRows: MailMessages[],
  ): Promise<Map<string, MailMessages>> {
    const inboundIds = inboundRows.map((row) => row.gmailMessageId);
    if (!inboundIds.length) return new Map();

    const drafts = await this.mailMessagesRepo.find({
      where: {
        inReplyToGmailMessageId: In(inboundIds),
        direction: 'outbound',
        status: 'draft',
      },
    });

    return new Map(
      drafts
        .filter((draft) => draft.inReplyToGmailMessageId)
        .map((draft) => [draft.inReplyToGmailMessageId as string, draft]),
    );
  }

  private toInboundListItem(
    row: MailMessages,
    draftByInbound: Map<string, MailMessages>,
  ): MailInboundListItem {
    const draft = draftByInbound.get(row.gmailMessageId);
    return {
      id: row.id,
      gmailMessageId: row.gmailMessageId,
      fromEmail: row.fromEmail,
      subject: row.subject ?? null,
      body: sanitizeInboundEmailBody(row.body),
      status: row.status,
      threadId: row.threadId ?? null,
      ruleId: row.ruleId ?? null,
      createdAt: row.created_at.toISOString(),
      gmailThreadUrl: row.threadId
        ? `https://mail.google.com/mail/u/0/#inbox/${row.threadId}`
        : null,
      hasDraft: Boolean(draft),
      draftId: draft?.id ?? null,
    };
  }

  private toDraftListItem(row: MailMessages): MailDraftListItem {
    return {
      id: row.id,
      toEmail: row.toEmail ?? '',
      subject: row.subject ?? null,
      body: row.body,
      status: row.status,
      threadId: row.threadId ?? null,
      gmailDraftId: row.gmailDraftId ?? null,
      inReplyToGmailMessageId: row.inReplyToGmailMessageId ?? null,
      ruleId: row.ruleId ?? null,
      createdAt: row.created_at.toISOString(),
      gmailThreadUrl: row.threadId
        ? `https://mail.google.com/mail/u/0/#inbox/${row.threadId}`
        : null,
      gmailDraftsUrl: 'https://mail.google.com/mail/u/0/#drafts',
    };
  }
}
