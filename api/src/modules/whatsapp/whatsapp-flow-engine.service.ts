import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  WhatsappCredentials,
  WhatsappMessagingService,
} from './whatsapp-messaging.service';
import { WhatsappFlowSessionService } from './whatsapp-flow-session.service';
import { ConfigurableMenuFlow } from './flows/configurable-menu.flow';
import { WhatsappFlowAiService } from './whatsapp-flow-ai.service';
import { FlowOutboundMessage, FLOW_STATES } from './whatsapp-flow.types';
import { WhatsappMessages } from './entities/whatsapp_messages.entity';

@Injectable()
export class WhatsappFlowEngineService {
  private readonly logger = new Logger(WhatsappFlowEngineService.name);

  constructor(
    private readonly sessions: WhatsappFlowSessionService,
    private readonly messaging: WhatsappMessagingService,
    private readonly menuFlow: ConfigurableMenuFlow,
    private readonly flowAi: WhatsappFlowAiService,
    private readonly config: ConfigService,
    @InjectRepository(WhatsappMessages)
    private readonly messagesRepo: Repository<WhatsappMessages>,
  ) {}

  async tryHandleInbound(params: {
    tenantId: string;
    workspaceId?: string;
    phone: string;
    text: string;
    interactiveId?: string;
    creds: WhatsappCredentials;
    contactId?: string;
    leadId?: string;
  }): Promise<boolean> {
    const config = await this.sessions.getConfig(
      params.tenantId,
      params.workspaceId,
    );
    const globallyEnabled =
      this.config.get<string>('WHATSAPP_FLOW_ENABLED') === 'true';
    if (!config.enabled && !globallyEnabled) return false;

    const normalizedText = params.text.trim().toLowerCase();
    const triggers = (config.welcomeTriggers ?? []).map((t) => t.toLowerCase());
    const session = await this.sessions.getSession(
      params.tenantId,
      params.phone,
    );

    const isWelcome =
      triggers.includes(normalizedText) ||
      normalizedText === 'menu' ||
      normalizedText === '0';

    if (!session && !isWelcome && !params.interactiveId) {
      return false;
    }

    const state = session?.currentState ?? FLOW_STATES.MAIN_MENU;
    const flowContext = {
      ...(session?.context ?? {}),
      menuItems: config.menuItems,
      welcomeMessage: config.welcomeMessage,
      welcomeTriggers: config.welcomeTriggers,
    };

    let result = this.menuFlow.handle(
      state,
      {
        tenantId: params.tenantId,
        phone: params.phone,
        text: params.text,
        interactiveId: params.interactiveId,
        serviceName: config.serviceName || 'MyService',
        aiFallbackEnabled: config.aiFallbackEnabled,
      },
      flowContext,
    );

    result = await this.applyAiIfNeeded(result, config, params);

    if (result.endSession) {
      await this.sessions.clearSession(params.tenantId, params.phone);
    } else {
      await this.sessions.saveSession(
        params.tenantId,
        params.phone,
        result.nextState,
        result.context ?? flowContext,
      );
    }

    for (const msg of result.messages) {
      const sent = await this.dispatchMessage(params.creds, params.phone, msg);
      if (sent.success) {
        await this.messagesRepo.save(
          this.messagesRepo.create({
            tenantId: params.tenantId,
            workspaceId: params.workspaceId,
            contactId: params.contactId,
            leadId: params.leadId,
            phone: params.phone,
            direction: 'outbound',
            body: this.describeOutbound(msg),
            waMessageId: sent.waMessageId,
            status: 'flow_reply',
          }),
        );
      }
    }

    this.logger.log(
      `WhatsApp menu flow → ${result.nextState} (${params.phone})`,
    );
    return true;
  }

  private async applyAiIfNeeded(
    result: Awaited<ReturnType<ConfigurableMenuFlow['handle']>>,
    config: Awaited<ReturnType<WhatsappFlowSessionService['getConfig']>>,
    params: { tenantId: string; phone: string; text: string },
  ) {
    if (result.aiMenuItem) {
      const body = await this.flowAi.generateMenuItemReply({
        tenantId: params.tenantId,
        serviceName: config.serviceName,
        item: result.aiMenuItem,
        customerPhone: params.phone,
      });
      result.messages = [
        { kind: 'text', body },
        {
          kind: 'buttons',
          body: 'Anything else?',
          buttons: [{ id: 'main_menu', title: 'Main menu' }],
        },
      ];
    } else if (result.aiFreeText) {
      const body = await this.flowAi.generateFreeTextReply({
        tenantId: params.tenantId,
        serviceName: config.serviceName,
        inboundText: result.aiFreeText,
        customerPhone: params.phone,
        menuTitles: config.menuItems.map((i) => i.title),
      });
      result.messages = [
        { kind: 'text', body },
        {
          kind: 'buttons',
          body: 'Need the menu?',
          buttons: [{ id: 'main_menu', title: 'Main menu' }],
        },
      ];
    }

    delete result.aiMenuItem;
    delete result.aiFreeText;
    return result;
  }

  private async dispatchMessage(
    creds: WhatsappCredentials,
    phone: string,
    msg: FlowOutboundMessage,
  ) {
    switch (msg.kind) {
      case 'text':
        return this.messaging.sendSessionText(creds, phone, msg.body);
      case 'buttons':
        return this.messaging.sendInteractiveButtons(
          creds,
          phone,
          msg.body,
          msg.buttons,
        );
      case 'list':
        return this.messaging.sendInteractiveList(
          creds,
          phone,
          msg.body,
          msg.buttonLabel,
          msg.sections,
        );
      default:
        return { success: false, error: 'Unknown message kind' };
    }
  }

  private describeOutbound(msg: FlowOutboundMessage): string {
    if (msg.kind === 'text') return msg.body;
    if (msg.kind === 'buttons') {
      return `${msg.body}\n[${msg.buttons.map((b) => b.title).join(' | ')}]`;
    }
    const rows = msg.sections.flatMap((s) => s.rows.map((r) => r.title));
    return `${msg.body}\n[${rows.join(', ')}]`;
  }
}
