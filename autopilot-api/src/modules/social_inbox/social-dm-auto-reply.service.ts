import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import axios from 'axios';
import { AutoReplyRulesService } from '../auto_reply_rules/auto_reply_rules.service';
import { BrandProfiles } from '../brand_profiles/entities/brand_profiles.entity';
import { Tenants } from '../tenants/entities/tenants.entity';
import { MistralChatService } from '../ai/services/mistral-chat.service';
import { PromptBuilderService } from '../ai/services/prompt-builder.service';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { SocialMessages } from './entities/social_messages.entity';

@Injectable()
export class SocialDmAutoReplyService {
  private readonly logger = new Logger(SocialDmAutoReplyService.name);

  constructor(
    private readonly rules: AutoReplyRulesService,
    private readonly mistral: MistralChatService,
    private readonly prompts: PromptBuilderService,
    @InjectRepository(BrandProfiles)
    private readonly brandRepo: Repository<BrandProfiles>,
    @InjectRepository(Tenants)
    private readonly tenantsRepo: Repository<Tenants>,
    @InjectRepository(SocialMessages)
    private readonly messagesRepo: Repository<SocialMessages>,
  ) {}

  async tryReply(params: {
    tenantId: string;
    platform: string;
    threadId: string;
    participantId: string;
    participantName?: string;
    inboundText: string;
    account: SocialAccounts;
    userId?: string;
  }): Promise<boolean> {
    const activeRules = await this.rules.findActiveForPlatform(
      params.tenantId,
      params.platform,
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

    const sent = await this.sendDm(
      params.account,
      params.participantId,
      replyText.trim(),
      params.platform,
    );
    if (!sent) return false;

    await this.messagesRepo.save(
      this.messagesRepo.create({
        tenantId: params.tenantId,
        workspaceId: params.account.workspaceId,
        platform: params.platform,
        threadId: params.threadId,
        participantId: params.participantId,
        participantName: params.participantName,
        direction: 'outbound',
        body: replyText.trim(),
        attachments: [],
        reactions: [],
        status: 'auto_reply',
      }),
    );

    this.logger.log(
      `DM auto-reply sent on ${params.platform} (rule: ${rule.name})`,
    );
    return true;
  }

  private async sendDm(
    account: SocialAccounts,
    recipientId: string,
    message: string,
    platform: string,
  ): Promise<boolean> {
    const token = account.metadata?.page_token ?? account.accessToken;
    if (!token?.trim()) {
      this.logger.warn(
        `DM auto-reply skipped: missing page token for ${platform}`,
      );
      return false;
    }
    const pageId = account.metadata?.page_id;
    const endpoint = pageId
      ? `https://graph.facebook.com/v20.0/${pageId}/messages`
      : 'https://graph.facebook.com/v20.0/me/messages';
    try {
      await axios.post(
        endpoint,
        {
          recipient: { id: recipientId },
          message: { text: message },
        },
        { params: { access_token: token } },
      );
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`DM auto-reply send failed (${platform}): ${msg}`);
      return false;
    }
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
            content: `Customer direct message:\n${inboundText}\n\nWrite a helpful reply.`,
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
