import { RequirePermission } from '../auth/rbac/require-permission.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantAccessService } from '../auth/rbac/tenant-access.service';
import { WhatsappMessages } from './entities/whatsapp_messages.entity';
import { WhatsappMessagingService } from './whatsapp-messaging.service';
import { WhatsappAccountAuthService } from './whatsapp-account-auth.service';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { Tenants } from '../tenants/entities/tenants.entity';
import { sharedNumberGreeting } from './whatsapp-inbound.service';
import { WhatsappFlowSessionService } from './whatsapp-flow-session.service';
import { UpdateWhatsappFlowConfigDto } from './dto/update-whatsapp-flow-config.dto';
import {
  applyWorkspaceScope,
} from '../../common/workspace-scope.util';

interface JwtUser {
  sub: string;
}

@ApiTags('WhatsApp')
@Controller('api/v1/whatsapp')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WhatsappController {
  constructor(
    @InjectRepository(WhatsappMessages)
    private readonly messagesRepo: Repository<WhatsappMessages>,
    private readonly messaging: WhatsappMessagingService,
    private readonly waAuth: WhatsappAccountAuthService,
    @InjectRepository(SocialAccounts)
    private readonly socialRepo: Repository<SocialAccounts>,
    private readonly flowSessions: WhatsappFlowSessionService,
    @InjectRepository(Tenants)
    private readonly tenantsRepo: Repository<Tenants>,
    private readonly access: TenantAccessService,
  ) {}

  private async findWhatsappAccount(
    tenantId: string,
    userId: string,
    workspaceId?: string,
  ) {
    const qb = this.socialRepo
      .createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId })
      .andWhere('a.platform = :platform', { platform: 'whatsapp' })
      .andWhere('a.connected = true');
    applyWorkspaceScope(qb, 'a', workspaceId);
    const accounts = await qb.getMany();
    return accounts.find((a) => a.userId === userId) ?? accounts[0] ?? null;
  }

  @RequirePermission('chatbot.view')
  @Get('flows/sessions')
  @ApiOperation({ summary: 'List all active flow sessions for a tenant' })
  async listFlowSessions(
    @Query('tenantId') tenantId: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const sessions = await this.flowSessions.listSessions(tenantId, workspaceId);
    return sessions.map((s) => ({
      id: s.id,
      phone: s.phone,
      currentState: s.currentState,
      expiresAt: s.expiresAt,
      updatedAt: s.updated_at,
    }));
  }

  @RequirePermission('replies.manage_rules')
  @Delete('flows/sessions')
  @ApiOperation({ summary: 'Reset (clear) a flow session for a specific phone' })
  async resetFlowSession(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantId: string,
    @Query('phone') phone: string,
  ) {
    await this.access.assertMember(String(req.user.sub), tenantId, 'chatbot.manage');
    await this.flowSessions.clearSession(tenantId, phone);
    return { cleared: true };
  }

  @Get('flows/config')
  @ApiOperation({
    summary: 'Get WhatsApp USSD-style menu flow config for a workspace',
  })
  getFlowConfig(
    @Query('tenantId') tenantId: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    return this.flowSessions.getConfig(tenantId, workspaceId);
  }

  @RequirePermission('replies.manage_rules')
  @Patch('flows/config')
  @ApiOperation({
    summary: 'Enable/configure WhatsApp menu flow (USSD-style bot)',
  })
  async updateFlowConfig(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantId: string,
    @Body() dto: UpdateWhatsappFlowConfigDto,
    @Query('workspaceId') workspaceId?: string,
  ) {
    await this.access.assertMember(String(req.user.sub), tenantId, 'chatbot.manage');
    return this.flowSessions.updateConfig(tenantId, dto, workspaceId);
  }

  @RequirePermission('replies.view')
  @Get('messages')
  async listMessages(
    @Query('tenantId') tenantId: string,
    @Query('phone') phone?: string,
    @Query('contactId') contactId?: string,
    @Query('take') take?: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const limit = Math.min(parseInt(take ?? '100', 10) || 100, 500);
    const qb = this.messagesRepo
      .createQueryBuilder('m')
      .where('m.tenantId = :tenantId', { tenantId })
      .orderBy('m.created_at', 'ASC')
      .take(limit);

    applyWorkspaceScope(qb, 'm', workspaceId);

    if (contactId?.trim()) {
      qb.andWhere('m.contactId = :contactId', { contactId: contactId.trim() });
    } else if (phone?.trim()) {
      qb.andWhere('m.phone = :phone', {
        phone: this.messaging.normalizePhone(phone),
      });
    }

    const rows = await qb.getMany();
    return rows.map((m) => ({
      id: m.id,
      tenantId: m.tenantId,
      contactId: m.contactId,
      leadId: m.leadId,
      phone: m.phone,
      direction: m.direction,
      body: m.body,
      status: m.status,
      error_message: m.errorMessage,
      attachments: m.attachments ?? [],
      reactions: m.reactions ?? [],
      created_at: m.created_at,
    }));
  }

  @Get('connection-status')
  @ApiOperation({ summary: 'Verify WhatsApp token and phone number id' })
  async connectionStatus(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantId: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const account = await this.findWhatsappAccount(
      tenantId,
      String(req.user.sub),
      workspaceId,
    );
    if (!account) {
      return { connected: false, message: 'WhatsApp not connected' };
    }

    const platformManaged = account.metadata?.platform_managed === true;
    const { creds } = await this.waAuth.credentialsForAccount(account);
    if (!creds) {
      return {
        connected: false,
        platformManaged,
        message: platformManaged
          ? 'Platform WhatsApp credentials missing on the server (WHATSAPP_PLATFORM_* env vars).'
          : 'WhatsApp credentials missing — reconnect in Publisher Connect.',
      };
    }

    const validation = await this.messaging.validateCredentials(creds);
    if (!validation.valid) {
      return {
        connected: false,
        platformManaged,
        tokenValid: false,
        phoneNumberId: creds.phoneNumberId,
        graphError: validation.error,
        message: platformManaged
          ? this.messaging.platformTokenErrorMessage(validation.error)
          : this.messaging.oauthTokenErrorMessage(),
      };
    }

    const apiBase = (process.env.PUBLIC_API_URL ?? process.env.API_PUBLIC_URL ?? '')
      .replace(/\/$/, '');
    // On the shared Mako number, customers must come through this link so their first
    // message carries the workspace's code.
    let chatLink: string | undefined;
    const digits = (validation.displayPhoneNumber ?? '').replace(/\D/g, '');
    if (digits) {
      const tenant = platformManaged
        ? await this.tenantsRepo.findOne({ where: { id: account.tenantId } })
        : null;
      const text = tenant ? `?text=${encodeURIComponent(sharedNumberGreeting(tenant.name, tenant.slug))}` : '';
      chatLink = `https://wa.me/${digits}${text}`;
    }
    return {
      chatLink,
      connected: true,
      tokenValid: true,
      phoneNumberId: creds.phoneNumberId,
      displayPhoneNumber: validation.displayPhoneNumber,
      accountName: account.accountName,
      workspaceId: account.workspaceId ?? null,
      platformManaged,
      webhookUrl: apiBase
        ? `${apiBase}/api/v1/webhooks/meta`
        : '/api/v1/webhooks/meta',
    };
  }

  @RequirePermission('replies.create')
  @Post('messages/reply')
  async reply(
    @Req() req: { user: JwtUser },
    @Body()
    body: {
      tenantId: string;
      phone: string;
      message: string;
      leadId?: string;
      contactId?: string;
      workspaceId?: string;
      /** Send as Meta-approved template (works outside the 24h session window). */
      useTemplate?: boolean;
      templateName?: string;
      templateLanguage?: string;
    },
  ) {
    const userId = String(req.user.sub);
    // Sending from the business's number is a reply; viewers and creators can only read.
    await this.access.assertMember(userId, body.tenantId, 'replies.create');
    const account = await this.findWhatsappAccount(
      body.tenantId,
      userId,
      body.workspaceId,
    );
    if (!account) {
      return { sent: false, message: 'WhatsApp not connected' };
    }

    const result = await this.waAuth.sendReply(
      account,
      body.phone,
      body.message,
      {
        useTemplate: body.useTemplate,
        templateName: body.templateName,
        templateLanguage: body.templateLanguage,
      },
    );
    if (!result.success) {
      return {
        sent: false,
        message: this.messaging.humanizeSendError(result.error),
      };
    }

    await this.messagesRepo.save(
      this.messagesRepo.create({
        tenantId: body.tenantId,
        workspaceId: account.workspaceId ?? body.workspaceId,
        contactId: body.contactId,
        leadId: body.leadId,
        phone: this.messaging.normalizePhone(body.phone),
        direction: 'outbound',
        body: body.message.trim(),
        waMessageId: result.waMessageId,
        status: result.usedTemplate ? 'template' : 'sent',
      }),
    );

    return {
      sent: true,
      waMessageId: result.waMessageId,
      usedTemplate: result.usedTemplate ?? false,
    };
  }

  @Get('message-templates')
  @ApiOperation({
    summary: 'List approved Meta HSM templates for sending (not the local template registry)',
  })
  async listTemplates(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantId: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const userId = String(req.user.sub);
    const account = await this.findWhatsappAccount(
      tenantId,
      userId,
      workspaceId,
    );
    const creds = account
      ? this.messaging.credentialsFromAccount(account)
      : null;
    if (!creds) return { templates: [], message: 'WhatsApp not connected' };

    const templates = await this.messaging.listMessageTemplates(creds);
    const envDefault = process.env.WHATSAPP_BROADCAST_TEMPLATE?.trim();
    return {
      templates,
      defaultTemplate: envDefault || templates[0]?.name || 'hello_world',
    };
  }

  @RequirePermission('replies.view')
  @Get('conversations')
  async conversations(
    @Query('tenantId') tenantId: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const qb = this.messagesRepo
      .createQueryBuilder('m')
      .where('m.tenantId = :tenantId', { tenantId })
      .orderBy('m.created_at', 'DESC');

    applyWorkspaceScope(qb, 'm', workspaceId);

    const rows = await qb.getMany();

    const byPhone = new Map<
      string,
      { phone: string; lastMessage: string; lastAt: Date; inboundCount: number }
    >();

    for (const m of rows) {
      const existing = byPhone.get(m.phone);
      if (!existing) {
        byPhone.set(m.phone, {
          phone: m.phone,
          lastMessage: m.body,
          lastAt: m.created_at,
          inboundCount: m.direction === 'inbound' ? 1 : 0,
        });
      } else if (m.direction === 'inbound') {
        existing.inboundCount++;
      }
    }

    return Array.from(byPhone.values()).sort(
      (a, b) => b.lastAt.getTime() - a.lastAt.getTime(),
    );
  }
}
