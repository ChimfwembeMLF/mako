import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AutoReplyRulesService } from '../auto_reply_rules/auto_reply_rules.service';
import { TenantMembers } from '../tenant_members/entities/tenant_members.entity';
import { UserEntity } from '../user/user.entity';
import { GmailAutoReplyService } from './gmail-auto-reply.service';
import { GmailClientService } from './gmail-client.service';
import { GmailInboxConnection } from './entities/gmail_inbox_connection.entity';
import { MailMessages } from './entities/mail_messages.entity';

@Injectable()
export class GmailInboxSyncService {
  private readonly logger = new Logger(GmailInboxSyncService.name);

  constructor(
    private readonly gmailClient: GmailClientService,
    private readonly autoReply: GmailAutoReplyService,
    private readonly rules: AutoReplyRulesService,
    @InjectRepository(GmailInboxConnection)
    private readonly connectionsRepo: Repository<GmailInboxConnection>,
    @InjectRepository(MailMessages)
    private readonly mailMessagesRepo: Repository<MailMessages>,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    @InjectRepository(TenantMembers)
    private readonly membersRepo: Repository<TenantMembers>,
  ) {}

  async syncAll(): Promise<{ processed: number; replied: number }> {
    await this.ensureConnections();
    const connections = await this.connectionsRepo.find({
      where: { isActive: true },
    });

    let processed = 0;
    let replied = 0;

    for (const connection of connections) {
      const result = await this.syncConnection(connection);
      processed += result.processed;
      replied += result.replied;
    }

    return { processed, replied };
  }

  async syncForUser(
    userId: string,
    tenantId: string,
  ): Promise<{ processed: number; replied: number }> {
    const connection = await this.connectionsRepo.findOne({
      where: { userId, tenantId, isActive: true },
    });
    if (!connection) {
      return { processed: 0, replied: 0 };
    }
    return this.syncConnection(connection);
  }

  private async syncConnection(
    connection: GmailInboxConnection,
  ): Promise<{ processed: number; replied: number }> {
    const activeRules = await this.rules.findActiveForPlatform(
      connection.tenantId,
      'email',
      connection.workspaceId,
    );
    if (!activeRules.length) {
      return { processed: 0, replied: 0 };
    }

    let processed = 0;
    let replied = 0;

    try {
      const messageIds = await this.gmailClient.listUnreadInboxMessageIds(
        connection.userId,
        25,
      );

      for (const messageId of messageIds) {
        const already = await this.mailMessagesRepo.findOne({
          where: { gmailMessageId: messageId },
        });
        if (already) continue;

        const message = await this.gmailClient.getMessage(
          connection.userId,
          messageId,
        );
        if (!message || !message.isUnread || !message.fromEmail) continue;

        if (this.shouldSkipSender(message.fromEmail)) {
          await this.mailMessagesRepo.save(
            this.mailMessagesRepo.create({
              tenantId: connection.tenantId,
              userId: connection.userId,
              workspaceId: connection.workspaceId,
              gmailMessageId: message.id,
              threadId: message.threadId,
              fromEmail: message.fromEmail,
              subject: message.subject,
              body: message.body,
              direction: 'inbound',
              status: 'skipped',
            }),
          );
          processed += 1;
          continue;
        }

        const sent = await this.autoReply.tryReply({
          tenantId: connection.tenantId,
          userId: connection.userId,
          workspaceId: connection.workspaceId,
          fromEmail: message.fromEmail,
          subject: message.subject,
          body: message.body,
          gmailMessageId: message.id,
          threadId: message.threadId,
          messageIdHeader: message.messageIdHeader,
        });
        processed += 1;
        if (sent) replied += 1;
      }

      const historyId = await this.gmailClient.getProfileHistoryId(
        connection.userId,
      );
      await this.connectionsRepo.update(connection.id, {
        historyId: historyId ?? connection.historyId,
        lastSyncedAt: new Date(),
      });
    } catch (error) {
      if (this.gmailClient.isInsufficientScopeError(error)) {
        this.logger.warn(
          `Gmail inbox sync needs reconnect for user ${connection.userId} (missing read scope)`,
        );
      } else {
        this.logger.error(
          `Gmail inbox sync failed for connection ${connection.id}`,
          error,
        );
      }
    }

    return { processed, replied };
  }

  async upsertConnection(params: {
    tenantId: string;
    userId: string;
    workspaceId?: string;
  }): Promise<GmailInboxConnection> {
    const existing = await this.connectionsRepo.findOne({
      where: { tenantId: params.tenantId, userId: params.userId },
    });
    if (existing) {
      await this.connectionsRepo.update(existing.id, {
        workspaceId: params.workspaceId ?? existing.workspaceId,
        isActive: true,
      });
      return this.connectionsRepo.findOneByOrFail({ id: existing.id });
    }

    return this.connectionsRepo.save(
      this.connectionsRepo.create({
        tenantId: params.tenantId,
        userId: params.userId,
        workspaceId: params.workspaceId,
        isActive: true,
      }),
    );
  }

  async deactivateForUser(userId: string): Promise<void> {
    await this.connectionsRepo.update({ userId }, { isActive: false });
  }

  private async ensureConnections(): Promise<void> {
    const users = await this.usersRepo
      .createQueryBuilder('user')
      .select(['user.id'])
      .where('user.googleAccessTokenEnc IS NOT NULL')
      .getMany();

    for (const user of users) {
      const memberships = await this.membersRepo.find({
        where: { userId: user.id, isActive: true },
      });
      for (const membership of memberships) {
        const activeRules = await this.rules.findActiveForPlatform(
          membership.tenantId,
          'email',
        );
        if (!activeRules.length) continue;

        await this.upsertConnection({
          tenantId: membership.tenantId,
          userId: user.id,
        });
      }
    }
  }

  private shouldSkipSender(email: string): boolean {
    const lower = email.toLowerCase();
    return (
      lower.includes('noreply') ||
      lower.includes('no-reply') ||
      lower.includes('mailer-daemon') ||
      lower.includes('donotreply') ||
      lower.endsWith('@facebookmail.com') ||
      lower.endsWith('@google.com')
    );
  }
}
