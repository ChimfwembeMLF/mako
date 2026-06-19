import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AutoReplyRulesService } from '../auto_reply_rules/auto_reply_rules.service';
import { BrandProfiles } from '../brand_profiles/entities/brand_profiles.entity';
import { Tenants } from '../tenants/entities/tenants.entity';
import { MistralChatService } from '../ai/services/mistral-chat.service';
import { PromptBuilderService } from '../ai/services/prompt-builder.service';
import { WhatsappMessagingService } from './whatsapp-messaging.service';
import { WhatsappAccountAuthService } from './whatsapp-account-auth.service';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { WhatsappMessages } from './entities/whatsapp_messages.entity';

@Injectable()
export class WhatsappAutoReplyService {
  private readonly logger = new Logger(WhatsappAutoReplyService.name);

  constructor(
    private readonly rules: AutoReplyRulesService,
    private readonly messaging: WhatsappMessagingService,
    private readonly waAuth: WhatsappAccountAuthService,
    private readonly mistral: MistralChatService,
    private readonly prompts: PromptBuilderService,
    @InjectRepository(BrandProfiles)
    private readonly brandRepo: Repository<BrandProfiles>,
    @InjectRepository(Tenants)
    private readonly tenantsRepo: Repository<Tenants>,
    @InjectRepository(WhatsappMessages)
    private readonly messagesRepo: Repository<WhatsappMessages>,
  ) {}

  async tryReply(params: {
    tenantId: string;
    phone: string;
    inboundText: string;
    account: SocialAccounts;
    contactId?: string;
    leadId?: string;
  }): Promise<boolean> {
    const activeRules = await this.rules.findActiveForPlatform(
      params.tenantId,
      'whatsapp',
      params.account.workspaceId,
    );
    const rule = this.rules.matchKeywordRule(activeRules, params.inboundText);
    if (!rule) return false;

    const replyText = await this.buildReplyText(
      params.tenantId,
      rule,
      params.inboundText,
      params.account.workspaceId,
    );
    if (!replyText?.trim()) return false;

    const result = await this.waAuth.sendSessionText(
      params.account,
      params.phone,
      replyText.trim(),
    );
    if (!result.success) {
      this.logger.warn(`WhatsApp auto-reply failed: ${result.error}`);
      return false;
    }

    await this.messagesRepo.save(
      this.messagesRepo.create({
        tenantId: params.tenantId,
        workspaceId: params.account.workspaceId,
        contactId: params.contactId,
        leadId: params.leadId,
        phone: this.messaging.normalizePhone(params.phone),
        direction: 'outbound',
        body: replyText.trim(),
        waMessageId: result.waMessageId,
        status: 'auto_reply',
      }),
    );

    this.logger.log(
      `WhatsApp auto-reply sent to ${params.phone} (rule: ${rule.name})`,
    );
    return true;
  }

  private async buildReplyText(
    tenantId: string,
    rule: { responseTemplate?: string; aiGenerate: boolean },
    inboundText: string,
    workspaceId?: string,
  ): Promise<string> {
    if (rule.aiGenerate) {
      const tenant = await this.tenantsRepo.findOne({
        where: { id: tenantId },
      });
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
            content: `Customer WhatsApp message:\n${inboundText}\n\nWrite a helpful reply.`,
          },
        ],
        { model: this.mistral.defaultModel },
      );
      return data.content?.trim() ?? '';
    }

    const template = rule.responseTemplate?.trim();
    if (!template) return '';
    return template
      .replace(/\{message\}/gi, inboundText)
      .replace(/\{customer_message\}/gi, inboundText);
  }
}
