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
import { sanitizeInboundEmailBody } from './email-reply.util';

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
    const existingDraft = await this.mailMessagesRepo.findOne({
      where: {
        inReplyToGmailMessageId: params.gmailMessageId,
        direction: 'outbound',
        status: 'draft',
      },
    });
    if (existingDraft) return false;

    const activeRules = await this.rules.findActiveForPlatform(
      params.tenantId,
      'email',
      params.workspaceId,
    );
    if (!activeRules.length) return false;

    const matchText = `${params.subject}\n${params.body}`.trim();
    const rule = this.rules.matchKeywordRule(activeRules, matchText);
    if (!rule) {
      await this.updateInboundStatus(params.gmailMessageId, 'skipped');
      return false;
    }

    const replyText = await this.buildReplyText(
      params.tenantId,
      params.userId,
      rule,
      params.fromEmail,
      params.subject,
      params.body,
      params.workspaceId,
    );
    if (!replyText?.trim()) {
      await this.updateInboundStatus(params.gmailMessageId, 'skipped', rule.id);
      return false;
    }

    const user = await this.userService.findOne({ id: params.userId });
    if (!user?.email) return false;

    const ownEmail = user.email.trim().toLowerCase();
    if (params.fromEmail === ownEmail) return false;

    try {
      const draft = await this.gmailClient.createDraft({
        userId: params.userId,
        fromEmail: user.email,
        toEmail: params.fromEmail,
        subject: params.subject,
        body: replyText.trim(),
        threadId: params.threadId,
        inReplyTo: params.messageIdHeader,
      });

      const replySubject = params.subject.startsWith('Re:')
        ? params.subject
        : `Re: ${params.subject}`;

      await this.updateInboundStatus(params.gmailMessageId, 'processed', rule.id);

      if (draft.draftId) {
        await this.mailMessagesRepo.save(
          this.mailMessagesRepo.create({
            tenantId: params.tenantId,
            userId: params.userId,
            workspaceId: params.workspaceId,
            gmailMessageId: `draft:${draft.draftId}`,
            gmailDraftId: draft.draftId,
            inReplyToGmailMessageId: params.gmailMessageId,
            threadId: params.threadId,
            fromEmail: ownEmail,
            toEmail: params.fromEmail,
            subject: replySubject,
            body: replyText.trim(),
            direction: 'outbound',
            status: 'draft',
            ruleId: rule.id,
          }),
        );
      }

      this.logger.log(
        `Gmail draft reply created for ${params.fromEmail} (rule: ${rule.name})`,
      );
      return true;
    } catch (error) {
      this.logger.warn(
        `Gmail auto-reply failed for ${params.gmailMessageId}: ${
          error instanceof Error ? error.message : error
        }`,
      );
      await this.updateInboundStatus(params.gmailMessageId, 'failed', rule.id);
      return false;
    }
  }

  private async updateInboundStatus(
    gmailMessageId: string,
    status: string,
    ruleId?: string,
  ) {
    await this.mailMessagesRepo.update(
      { gmailMessageId, direction: 'inbound' },
      { status, ...(ruleId ? { ruleId } : {}) },
    );
  }

  private async buildReplyText(
    tenantId: string,
    userId: string,
    rule: AutoReplyRules,
    fromEmail: string,
    subject: string,
    body: string,
    workspaceId?: string,
  ): Promise<string> {
    const cleanBody = sanitizeInboundEmailBody(body);

    if (rule.aiGenerate) {
      const tenant = await this.tenantsRepo.findOne({ where: { id: tenantId } });
      const brand = tenant
        ? workspaceId
          ? await this.brandRepo.findOne({ where: { tenantId, workspaceId } })
          : (await this.brandRepo.findOne({
              where: { tenantId, userId, workspaceId: IsNull() },
            })) ??
            (await this.brandRepo.findOne({
              where: {
                tenantId,
                userId: tenant.ownerId,
                workspaceId: IsNull(),
              },
            }))
        : null;
      const brandCtx = this.prompts.brandFromEntity(brand);
      const { data } = await this.mistral.completeJson<{ content?: string }>(
        [
          { role: 'system', content: this.prompts.emailReplySystem(brandCtx) },
          {
            role: 'user',
            content: this.prompts.emailReplyUser({
              fromEmail,
              subject,
              body: cleanBody,
            }),
          },
        ],
        { model: this.mistral.defaultModel },
      );
      return data.content?.trim() ?? '';
    }

    const template = rule.responseTemplate?.trim();
    if (!template) return '';
    return template
      .replace(/\{message\}/gi, cleanBody)
      .replace(/\{customer_message\}/gi, cleanBody)
      .replace(/\{subject\}/gi, subject);
  }
}
