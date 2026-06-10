import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WhatsappMessages } from './entities/whatsapp_messages.entity';
import { WhatsappMessagingService } from './whatsapp-messaging.service';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';

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
    @InjectRepository(SocialAccounts)
    private readonly socialRepo: Repository<SocialAccounts>,
  ) {}

  @Get('messages')
  async listMessages(
    @Query('tenantId') tenantId: string,
    @Query('phone') phone?: string,
    @Query('take') take?: string,
  ) {
    const limit = Math.min(parseInt(take ?? '50', 10) || 50, 200);
    const qb = this.messagesRepo
      .createQueryBuilder('m')
      .where('m.tenantId = :tenantId', { tenantId })
      .orderBy('m.created_at', 'DESC')
      .take(limit);

    if (phone?.trim()) {
      qb.andWhere('m.phone = :phone', { phone: this.messaging.normalizePhone(phone) });
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
      created_at: m.created_at,
    }));
  }

  @Post('messages/reply')
  async reply(
    @Req() req: { user: JwtUser },
    @Body() body: { tenantId: string; phone: string; message: string },
  ) {
    const userId = String(req.user.sub);
    const account =
      (await this.socialRepo.findOne({
        where: { tenantId: body.tenantId, userId, platform: 'whatsapp', connected: true },
      })) ??
      (await this.socialRepo.findOne({
        where: { tenantId: body.tenantId, platform: 'whatsapp', connected: true },
      }));
    const creds = account ? this.messaging.credentialsFromAccount(account) : null;
    if (!creds) {
      return { sent: false, message: 'WhatsApp not connected' };
    }

    const result = await this.messaging.sendSessionText(creds, body.phone, body.message);
    if (!result.success) {
      return { sent: false, message: result.error ?? 'Send failed' };
    }

    await this.messagesRepo.save(
      this.messagesRepo.create({
        tenantId: body.tenantId,
        phone: this.messaging.normalizePhone(body.phone),
        direction: 'outbound',
        body: body.message.trim(),
        waMessageId: result.waMessageId,
        status: 'sent',
      }),
    );

    return { sent: true, waMessageId: result.waMessageId };
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
    const creds = account ? this.messaging.credentialsFromAccount(account) : null;
    if (!creds) return { templates: [], message: 'WhatsApp not connected' };

    const templates = await this.messaging.listMessageTemplates(creds);
    const envDefault = process.env.WHATSAPP_BROADCAST_TEMPLATE?.trim();
    return {
      templates,
      defaultTemplate: envDefault || templates[0]?.name || 'hello_world',
    };
  }

  @Get('conversations')
  async conversations(@Query('tenantId') tenantId: string) {
    const rows = await this.messagesRepo
      .createQueryBuilder('m')
      .where('m.tenantId = :tenantId', { tenantId })
      .orderBy('m.created_at', 'DESC')
      .getMany();

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
