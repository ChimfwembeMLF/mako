import {
  Body,
  Controller,
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
import { WhatsappMessages } from './entities/whatsapp_messages.entity';
import { WhatsappMessagingService } from './whatsapp-messaging.service';
import { WhatsappAccountAuthService } from './whatsapp-account-auth.service';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { WhatsappFlowSessionService } from './whatsapp-flow-session.service';
import { UpdateWhatsappFlowConfigDto } from './dto/update-whatsapp-flow-config.dto';
import { scopeWhere } from '../../common/workspace-scope.util';

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
  ) {}

  private async findWhatsappAccount(
    tenantId: string,
    userId: string,
    workspaceId?: string,
  ) {
    return (
      (await this.socialRepo.findOne({
        where: {
          ...scopeWhere<SocialAccounts>(tenantId, workspaceId),
          userId,
          platform: 'whatsapp',
          connected: true,
        },
      })) ??
      (await this.socialRepo.findOne({
        where: {
          ...scopeWhere<SocialAccounts>(tenantId, workspaceId),
          platform: 'whatsapp',
          connected: true,
        },
      }))
    );
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

  @Patch('flows/config')
  @ApiOperation({
    summary: 'Enable/configure WhatsApp menu flow (USSD-style bot)',
  })
  updateFlowConfig(
    @Query('tenantId') tenantId: string,
    @Body() dto: UpdateWhatsappFlowConfigDto,
    @Query('workspaceId') workspaceId?: string,
  ) {
    return this.flowSessions.updateConfig(tenantId, dto, workspaceId);
  }

  @Get('messages')
  async listMessages(
    @Query('tenantId') tenantId: string,
    @Query('phone') phone?: string,
    @Query('take') take?: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const limit = Math.min(parseInt(take ?? '50', 10) || 50, 200);
    const qb = this.messagesRepo
      .createQueryBuilder('m')
      .where('m.tenantId = :tenantId', { tenantId })
      .orderBy('m.created_at', 'DESC')
      .take(limit);

    if (workspaceId) {
      qb.andWhere('m.workspaceId = :workspaceId', { workspaceId });
    }

    if (phone?.trim()) {
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
  ) {
    const account = await this.findWhatsappAccount(
      tenantId,
      String(req.user.sub),
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

    return {
      connected: true,
      tokenValid: true,
      phoneNumberId: creds.phoneNumberId,
      displayPhoneNumber: validation.displayPhoneNumber,
      accountName: account.accountName,
      platformManaged,
    };
  }

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

  @Get('templates')
  async listTemplates(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantId: string,
  ) {
    const userId = String(req.user.sub);
    const account =
      (await this.socialRepo.findOne({
        where: { tenantId, userId, platform: 'whatsapp', connected: true },
      })) ??
      (await this.socialRepo.findOne({
        where: { tenantId, platform: 'whatsapp', connected: true },
      }));
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

  @Get('conversations')
  async conversations(
    @Query('tenantId') tenantId: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const qb = this.messagesRepo
      .createQueryBuilder('m')
      .where('m.tenantId = :tenantId', { tenantId })
      .orderBy('m.created_at', 'DESC');

    if (workspaceId) {
      qb.andWhere('m.workspaceId = :workspaceId', { workspaceId });
    }

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
