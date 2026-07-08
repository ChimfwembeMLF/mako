import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BrandProfiles } from '../brand_profiles/entities/brand_profiles.entity';
import { Tenants } from '../tenants/entities/tenants.entity';
import { MistralChatService } from '../ai/services/mistral-chat.service';
import { PromptBuilderService } from '../ai/services/prompt-builder.service';
import { WhatsappMenuItem } from './whatsapp-menu.types';

@Injectable()
export class WhatsappFlowAiService {
  private readonly logger = new Logger(WhatsappFlowAiService.name);

  constructor(
    private readonly mistral: MistralChatService,
    private readonly prompts: PromptBuilderService,
    @InjectRepository(BrandProfiles)
    private readonly brandRepo: Repository<BrandProfiles>,
    @InjectRepository(Tenants)
    private readonly tenantsRepo: Repository<Tenants>,
  ) {}

  async generateMenuItemReply(params: {
    tenantId: string;
    serviceName: string;
    item: WhatsappMenuItem;
    customerPhone: string;
  }): Promise<string> {
    const brandCtx = await this.loadBrand(params.tenantId);
    const guidance =
      params.item.response?.trim() ||
      `Explain "${params.item.title}" briefly and helpfully.`;

    const { data } = await this.mistral.completeJson<{ content?: string }>(
      [
        {
          role: 'system',
          content:
            `${this.prompts.replySystem(brandCtx)}\n\n` +
            `You are replying on WhatsApp for ${params.serviceName}. ` +
            `Keep answers short (under 600 chars), plain text, friendly. No markdown.`,
        },
        {
          role: 'user',
          content:
            `Menu option selected: "${params.item.title}"` +
            (params.item.description ? ` (${params.item.description})` : '') +
            `\n\nStaff guidance / facts to include:\n${guidance}\n\nWrite the WhatsApp reply.`,
        },
      ],
      { model: this.mistral.defaultModel },
    );

    return data.content?.trim() || guidance.slice(0, 600);
  }

  async generateFreeTextReply(params: {
    tenantId: string;
    serviceName: string;
    inboundText: string;
    customerPhone: string;
    menuTitles?: string[];
  }): Promise<string> {
    const brandCtx = await this.loadBrand(params.tenantId);
    const menuHint = params.menuTitles?.length
      ? `\nAvailable menu options: ${params.menuTitles.join(
          ', ',
        )}. Mention they can reply "menu" to see options.`
      : '\nThey can reply "menu" to see options.';

    const { data } = await this.mistral.completeJson<{ content?: string }>(
      [
        {
          role: 'system',
          content:
            `${this.prompts.replySystem(brandCtx)}\n\n` +
            `WhatsApp assistant for ${params.serviceName}. Short, helpful, plain text.${menuHint}`,
        },
        {
          role: 'user',
          content: `Customer message:\n${params.inboundText}\n\nWrite a helpful WhatsApp reply.`,
        },
      ],
      { model: this.mistral.defaultModel },
    );

    return (
      data.content?.trim() ||
      `Thanks for your message. Reply *menu* to see what we can help with.`
    );
  }

  private async loadBrand(tenantId: string) {
    const tenant = await this.tenantsRepo.findOne({ where: { id: tenantId } });
    const brand = tenant
      ? await this.brandRepo.findOne({
          where: { tenantId, userId: tenant.ownerId },
        })
      : null;
    return this.prompts.brandFromEntity(brand);
  }
}
