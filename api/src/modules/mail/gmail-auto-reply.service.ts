import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AutoReplyRules } from '../auto_reply_rules/entities/auto_reply_rules.entity';
import { AutoReplyRulesService } from '../auto_reply_rules/auto_reply_rules.service';
import { BrandProfiles } from '../brand_profiles/entities/brand_profiles.entity';
import { Tenants } from '../tenants/entities/tenants.entity';
import { MistralChatService } from '../ai/services/mistral-chat.service';
import { PromptBuilderService } from '../ai/services/prompt-builder.service';
import { UserService } from '../user/user.service';
import { GmailClientService } from './gmail-client.service';
import { MailMessages } from './entities/mail_messages.entity';

@Injectable()
export class GmailAutoReplyService {
  private readonly logger = new Logger(GmailAutoReplyService.name);

  constructor(
    private readonly rules: AutoReplyRulesService,
    private readonly gmailClient: GmailClientService,
    private readonly userService: UserService,
    private readonly mistral: MistralChatService,
    private readonly prompts: PromptBuilderService,
    @InjectRepository(BrandProfiles)
    private readonly brandRepo: Repository<BrandProfiles>,
    @InjectRepository(Tenants)
    private readonly tenantsRepo: Repository<Tenants>,
    @InjectRepository(MailMessages)
    private readonly mailMessagesRepo: Repository<MailMessages>,
  ) {}

  async tryReply(params: {
    tenantId: string;
    userId: string;
    workspaceId?: string;
    fromEmail: string;
    subject: string;
    body: string;
    gmailMessageId: string;
    threadId?: string;
    messageIdHeader?: string;
  }): Promise<boolean> {
    const existing = await this.mailMessagesRepo.findOne({
      where: { gmailMessageId: params.gmailMessageId },
    });
    if (existing) return false;

    const activeRules = await this.rules.findActiveForPlatform(
      params.tenantId,
      'email',
      params.workspaceId,
    );
    if (!activeRules.length) return false;

    const matchText = `${params.subject}\n${params.body}`.trim();
    const rule = this.rules.matchKeywordRule(activeRules, matchText);
    if (!rule) {
      await this.recordMessage({
        ...params,
        direction: 'inbound',
        status: 'skipped',
      });
      return false;
    }

    const replyText = await this.buildReplyText(
      params.tenantId,
      rule,
      params.subject,
      params.body,
      params.workspaceId,
    );
    if (!replyText?.trim()) {
      await this.recordMessage({
        ...params,
        direction: 'inbound',
        status: 'skipped',
        ruleId: rule.id,
      });
      return false;
    }

    const user = await this.userService.findOne({ id: params.userId });
    if (!user?.email) return false;

    const ownEmail = user.email.trim().toLowerCase();
    if (params.fromEmail === ownEmail) return false;

    try {
      const sent = await this.gmailClient.sendReply({
        userId: params.userId,
        fromEmail: user.email,
        toEmail: params.fromEmail,
        subject: params.subject,
        body: replyText.trim(),
        threadId: params.threadId,
        inReplyTo: params.messageIdHeader,
      });

      await this.recordMessage({
        ...params,
        direction: 'inbound',
        status: 'inbound',
        ruleId: rule.id,
      });
      if (sent.id) {
        await this.mailMessagesRepo.save(
          this.mailMessagesRepo.create({
            tenantId: params.tenantId,
            userId: params.userId,
            workspaceId: params.workspaceId,
            gmailMessageId: `out:${sent.id}`,
            threadId: params.threadId,
            fromEmail: ownEmail,
            subject: params.subject.startsWith('Re:')
              ? params.subject
              : `Re: ${params.subject}`,
            body: replyText.trim(),
            direction: 'outbound',
            status: 'auto_reply',
            ruleId: rule.id,
          }),
        );
      }

      this.logger.log(
        `Gmail auto-reply sent to ${params.fromEmail} (rule: ${rule.name})`,
      );
      return true;
    } catch (error) {
      this.logger.warn(
        `Gmail auto-reply failed for ${params.gmailMessageId}: ${
          error instanceof Error ? error.message : error
        }`,
      );
      await this.recordMessage({
        ...params,
        direction: 'inbound',
        status: 'failed',
        ruleId: rule.id,
      });
      return false;
    }
  }

  private async recordMessage(params: {
    tenantId: string;
    userId: string;
    workspaceId?: string;
    gmailMessageId: string;
    threadId?: string;
    fromEmail: string;
    subject: string;
    body: string;
    direction: 'inbound' | 'outbound';
    status: string;
    ruleId?: string;
  }) {
    const existing = await this.mailMessagesRepo.findOne({
      where: { gmailMessageId: params.gmailMessageId },
    });
    if (existing) return;

    await this.mailMessagesRepo.save(
      this.mailMessagesRepo.create({
        tenantId: params.tenantId,
        userId: params.userId,
        workspaceId: params.workspaceId,
        gmailMessageId: params.gmailMessageId,
        threadId: params.threadId,
        fromEmail: params.fromEmail,
        subject: params.subject,
        body: params.body,
        direction: params.direction,
        status: params.status,
        ruleId: params.ruleId,
      }),
    );
  }

  private async buildReplyText(
    tenantId: string,
    rule: AutoReplyRules,
    subject: string,
    body: string,
    workspaceId?: string,
  ): Promise<string> {
    if (rule.aiGenerate) {
      const tenant = await this.tenantsRepo.findOne({ where: { id: tenantId } });
      const brand = tenant
        ? workspaceId
          ? await this.brandRepo.findOne({ where: { tenantId, workspaceId } })
          : await this.brandRepo.findOne({
              where: {
                tenantId,
                userId: tenant.ownerId,
                workspaceId: IsNull(),
              },
            })
        : null;
      const brandCtx = this.prompts.brandFromEntity(brand);
      const { data } = await this.mistral.completeJson<{ content?: string }>(
        [
          { role: 'system', content: this.prompts.replySystem(brandCtx) },
          {
            role: 'user',
            content: [
              `Inbound email subject: ${subject || '(no subject)'}`,
              `Inbound email body:\n${body}`,
              'Write a helpful, concise email reply in plain text.',
            ].join('\n\n'),
          },
        ],
        { model: this.mistral.defaultModel },
      );
      return data.content?.trim() ?? '';
    }

    const template = rule.responseTemplate?.trim();
    if (!template) return '';
    return template
      .replace(/\{message\}/gi, body)
      .replace(/\{customer_message\}/gi, body)
      .replace(/\{subject\}/gi, subject);
  }
}
