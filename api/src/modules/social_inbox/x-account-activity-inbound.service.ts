import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import {
  SocialMessages,
  InboxAttachment,
} from './entities/social_messages.entity';
import { SocialDmAutoReplyService } from './social-dm-auto-reply.service';

type ParsedInbound = {
  externalMessageId?: string;
  threadId: string;
  participantId: string;
  participantName?: string;
  body: string;
  direction: 'inbound' | 'outbound';
  attachments?: InboxAttachment[];
  status?: string;
};

@Injectable()
export class XAccountActivityInboundService {
  private readonly logger = new Logger(XAccountActivityInboundService.name);

  constructor(
    @InjectRepository(SocialAccounts)
    private readonly accountsRepo: Repository<SocialAccounts>,
    @InjectRepository(SocialMessages)
    private readonly messagesRepo: Repository<SocialMessages>,
    private readonly autoReply: SocialDmAutoReplyService,
  ) {}

  async handleWebhook(body: unknown): Promise<{ received: boolean }> {
    const payload = body as Record<string, unknown>;
    const forUserId = String(
      payload.for_user_id ?? payload.user_id ?? payload.account_id ?? '',
    ).trim();

    const account = forUserId
      ? await this.resolveAccount(forUserId)
      : await this.resolveAnyTwitterAccount();

    if (!account) {
      this.logger.debug('X webhook: no matching connected account');
      return { received: true };
    }

    await this.processLegacyAccountActivity(account, payload);
    await this.processTypedEvents(account, payload);

    return { received: true };
  }

  private async processLegacyAccountActivity(
    account: SocialAccounts,
    payload: Record<string, unknown>,
  ) {
    const dmEvents = payload.direct_message_events;
    if (Array.isArray(dmEvents)) {
      for (const evt of dmEvents) {
        const parsed = this.parseLegacyDm(account, evt as Record<string, unknown>);
        if (parsed) await this.persist(account, parsed);
      }
    }

    const tweets = payload.tweet_create_events;
    if (Array.isArray(tweets)) {
      for (const tweet of tweets) {
        const parsed = this.parseMentionTweet(
          account,
          tweet as Record<string, unknown>,
        );
        if (parsed) await this.persist(account, parsed);
      }
    }
  }

  private async processTypedEvents(
    account: SocialAccounts,
    payload: Record<string, unknown>,
  ) {
    const batches: unknown[] = [];

    if (Array.isArray(payload.events)) batches.push(...payload.events);
    if (payload.event_type) batches.push(payload);
    if (Array.isArray(payload.data)) batches.push(...payload.data);

    for (const raw of batches) {
      const evt = raw as Record<string, unknown>;
      const type = String(
        evt.event_type ?? evt.type ?? evt.event ?? '',
      ).toLowerCase();

      if (!type) continue;

      if (type === 'dm.read') {
        await this.handleDmRead(account, evt);
        continue;
      }

      if (
        type === 'dm.sent' ||
        type === 'chat.received' ||
        type === 'chat.sent' ||
        type === 'direct_message.create'
      ) {
        const parsed = this.parseModernDm(account, evt, type);
        if (parsed) await this.persist(account, parsed);
        continue;
      }

      if (type === 'post.mention.create' || type === 'tweet.mention') {
        const parsed = this.parseModernMention(account, evt);
        if (parsed) await this.persist(account, parsed);
        continue;
      }

      if (type === 'post.create' || type === 'tweet.create') {
        const parsed = this.parseOwnPost(account, evt);
        if (parsed) await this.persist(account, parsed);
      }
    }
  }

  private async resolveAccount(forUserId: string): Promise<SocialAccounts | null> {
    return this.accountsRepo
      .createQueryBuilder('a')
      .where('a.connected = true')
      .andWhere(`a.platform IN ('twitter', 'x')`)
      .andWhere(
        `(a.externalId = :id OR a.metadata->>'x_user_id' = :id OR a.metadata->>'user_id' = :id)`,
        { id: forUserId },
      )
      .getOne();
  }

  private async resolveAnyTwitterAccount(): Promise<SocialAccounts | null> {
    return this.accountsRepo
      .createQueryBuilder('a')
      .where('a.connected = true')
      .andWhere(`a.platform IN ('twitter', 'x')`)
      .orderBy('a.updated_at', 'DESC')
      .getOne();
  }

  private parseLegacyDm(
    account: SocialAccounts,
    evt: Record<string, unknown>,
  ): ParsedInbound | null {
    const type = String(evt.type ?? 'message_create');
    if (type === 'message_read' || type === 'read') return null;

    const msg = (evt.message_create ?? evt.message ?? evt) as Record<
      string,
      unknown
    >;
    const senderId = String(
      (msg.sender_id as string | undefined) ??
        (evt.sender_id as string | undefined) ??
        '',
    );
    if (!senderId) return null;

    const text = String(
      (msg as { message_data?: { text?: string } }).message_data?.text ??
        msg.text ??
        '',
    );
    const isOutbound = senderId === account.externalId;
    const participantId = isOutbound
      ? String((evt.target as { recipient_id?: string })?.recipient_id ?? senderId)
      : senderId;

    return {
      externalMessageId: String(evt.id ?? msg.id ?? ''),
      threadId: participantId,
      participantId,
      body: text,
      direction: isOutbound ? 'outbound' : 'inbound',
      status: isOutbound ? 'sent' : 'received',
    };
  }

  private parseModernDm(
    account: SocialAccounts,
    evt: Record<string, unknown>,
    type: string,
  ): ParsedInbound | null {
    const data = (evt.data ?? evt.payload ?? evt) as Record<string, unknown>;
    const senderId = String(
      data.sender_id ?? data.from_id ?? data.user_id ?? '',
    );
    const text = String(data.text ?? data.message ?? data.body ?? '').trim();
    if (!senderId && !text) return null;

    const isOutbound =
      type === 'dm.sent' ||
      type === 'chat.sent' ||
      senderId === account.externalId;
    const participantId = isOutbound
      ? String(data.recipient_id ?? data.to_id ?? data.participant_id ?? senderId)
      : senderId || 'unknown';

    return {
      externalMessageId: String(data.id ?? data.dm_event_id ?? evt.id ?? ''),
      threadId: String(
        data.dm_conversation_id ?? data.conversation_id ?? participantId,
      ),
      participantId,
      participantName:
        String(data.username ?? data.sender_username ?? '') || undefined,
      body: text || '(attachment)',
      direction: isOutbound ? 'outbound' : 'inbound',
      status: isOutbound ? 'sent' : 'received',
    };
  }

  private parseMentionTweet(
    account: SocialAccounts,
    tweet: Record<string, unknown>,
  ): ParsedInbound | null {
    const text = String(
      tweet.text ?? (tweet as { full_text?: string }).full_text ?? '',
    );
    const authorId = String(
      (tweet.user as { id_str?: string })?.id_str ??
        (tweet.user as { id?: string })?.id ??
        tweet.author_id ??
        '',
    );
    const tweetId = String(tweet.id_str ?? tweet.id ?? '');
    if (!tweetId || authorId === account.externalId) return null;

    const handle = (account.username ?? account.accountName ?? '')
      .replace(/^@/, '')
      .toLowerCase();
    if (handle && !text.toLowerCase().includes(`@${handle}`)) {
      return null;
    }

    const user = tweet.user as { name?: string; screen_name?: string } | undefined;

    return {
      externalMessageId: tweetId,
      threadId: `mention:${tweetId}`,
      participantId: authorId,
      participantName: user?.name ?? user?.screen_name,
      body: text,
      direction: 'inbound',
      status: 'received',
    };
  }

  private parseModernMention(
    account: SocialAccounts,
    evt: Record<string, unknown>,
  ): ParsedInbound | null {
    const data = (evt.data ?? evt.payload ?? evt) as Record<string, unknown>;
    return this.parseMentionTweet(account, {
      ...data,
      user: data.user ?? {
        id: data.author_id,
        name: data.author_name,
        screen_name: data.author_username,
      },
    });
  }

  private parseOwnPost(
    account: SocialAccounts,
    evt: Record<string, unknown>,
  ): ParsedInbound | null {
    const data = (evt.data ?? evt.payload ?? evt) as Record<string, unknown>;
    const text = String(data.text ?? data.body ?? '').trim();
    const tweetId = String(data.id ?? data.post_id ?? '');
    if (!text || !tweetId) return null;

    return {
      externalMessageId: tweetId,
      threadId: `post:${tweetId}`,
      participantId: account.externalId ?? 'self',
      body: text,
      direction: 'outbound',
      status: 'sent',
    };
  }

  private async handleDmRead(
    account: SocialAccounts,
    evt: Record<string, unknown>,
  ) {
    const data = (evt.data ?? evt) as Record<string, unknown>;
    const threadId = String(
      data.dm_conversation_id ?? data.conversation_id ?? data.sender_id ?? '',
    );
    if (!threadId) return;

    await this.messagesRepo
      .createQueryBuilder()
      .update(SocialMessages)
      .set({ status: 'read' })
      .where('tenantId = :tenantId', { tenantId: account.tenantId })
      .andWhere('platform IN (:...platforms)', { platforms: ['twitter', 'x'] })
      .andWhere('threadId = :threadId', { threadId })
      .andWhere('direction = :dir', { dir: 'outbound' })
      .execute();
  }

  private async persist(account: SocialAccounts, parsed: ParsedInbound) {
    const platform = account.platform === 'x' ? 'x' : 'twitter';

    if (parsed.externalMessageId) {
      const exists = await this.messagesRepo.findOne({
        where: {
          tenantId: account.tenantId,
          platform,
          externalMessageId: parsed.externalMessageId,
        },
      });
      if (exists) return;
    }

    const saved = await this.messagesRepo.save(
      this.messagesRepo.create({
        tenantId: account.tenantId,
        workspaceId: account.workspaceId,
        platform,
        threadId: parsed.threadId,
        externalMessageId: parsed.externalMessageId,
        participantId: parsed.participantId,
        participantName: parsed.participantName,
        direction: parsed.direction,
        body: parsed.body,
        attachments: parsed.attachments ?? [],
        reactions: [],
        status:
          parsed.status ??
          (parsed.direction === 'inbound' ? 'received' : 'sent'),
      }),
    );

    if (
      parsed.direction === 'inbound' &&
      parsed.body.trim() &&
      !parsed.threadId.startsWith('post:')
    ) {
      await this.autoReply.tryReply({
        tenantId: account.tenantId,
        platform,
        threadId: parsed.threadId,
        participantId: saved.participantId,
        inboundText: parsed.body,
        account,
      });
    }
  }
}
