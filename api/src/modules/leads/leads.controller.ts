import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  Headers,
  UnauthorizedException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { Leads } from './entities/leads.entity';
import { LeadsCreateDto } from './dto/create-leads.dto';
import { LeadsUpdateDto } from './dto/update-leads.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LeadClassifyService } from './services/lead-classify.service';
import { SendLeadEmailDto } from './dto/send-lead-email.dto';
import { LeadEmailService } from './services/lead-email.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadSources } from '../lead_sources/entities/lead_sources.entity';
import { QueueDispatchService } from '../queues/queue-dispatch.service';
import { BrandProfilesService } from '../brand_profiles/brand_profiles.service';
import { ChatbotConfigService } from '../chatbot/services/chatbot-config.service';

interface JwtUser {
  sub: string;
}

import { TenantsService } from '../tenants/tenants.service';

@ApiTags('Leads')
@Controller('api/v1/leads')
export class LeadsController {
  constructor(
    private readonly service: LeadsService,
    private readonly classify: LeadClassifyService,
    private readonly leadEmail: LeadEmailService,
    @InjectRepository(LeadSources)
    private readonly sourcesRepo: Repository<LeadSources>,
    private readonly queueDispatch: QueueDispatchService,
    private readonly tenantsService: TenantsService,
    private readonly brandProfiles: BrandProfilesService,
    private readonly chatbotConfig: ChatbotConfigService,
  ) {}

  @Post('webhook')
  async webhook(
    @Headers('x-webhook-secret') secret: string,
    @Body()
    body: {
      sourceId?: string;
      name?: string;
      email?: string;
      message?: string;
      source?: string;
    },
  ) {
    if (!body.sourceId || !secret) {
      throw new UnauthorizedException('sourceId and X-Webhook-Secret required');
    }
    const source = await this.sourcesRepo.findOne({
      where: { id: body.sourceId },
    });
    if (!source?.webhookSecret || source.webhookSecret !== secret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    if (this.queueDispatch.isEnabled()) {
      const { jobId, queue } = await this.queueDispatch.enqueueLeadWebhook({
        sourceId: body.sourceId,
        payload: body as Record<string, unknown>,
      });
      return { ok: true, queued: true, jobId, queue };
    }

    const classification = await this.classify.classify({
      tenantId: source.tenantId,
      userId: source.userId,
      name: body.name ?? 'Unknown',
      email: body.email ?? '',
      message: body.message ?? '',
    });
    const lead = await this.service.create({
      tenantId: source.tenantId,
      userId: source.userId,
      name: body.name ?? 'Unknown',
      email: body.email ?? '',
      source: body.source ?? source.label,
      message: body.message,
      classification: classification.label,
      status: 'new',
      aiReply: classification.suggestedReply,
    } as any);
    return { ok: true, leadId: lead.id, classification: classification.label };
  }

  @Post('contact-form/:tenantId')
  async contactFormSubmit(
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Body()
    body: {
      name?: string;
      email?: string;
      message?: string;
    },
  ) {
    if (!tenantId) {
      throw new UnauthorizedException('tenantId is required');
    }

    let tenant;
    try {
      tenant = await this.tenantsService.findOne(tenantId);
    } catch (e) {
      throw new UnauthorizedException('Invalid tenant');
    }

    if (!tenant) {
      throw new UnauthorizedException('Invalid tenant');
    }

    const classification = await this.classify.classify({
      tenantId,
      userId: tenant.ownerId,
      name: body.name ?? 'Unknown',
      email: body.email ?? '',
      message: body.message ?? '',
    });

    const existingLead = body.email ? await this.service.findByEmail(tenantId, body.email) : null;

    let lead;
    if (existingLead) {
      const updatedMessage = existingLead.message 
        ? `${existingLead.message}\n\n---\nNew message:\n${body.message}`
        : body.message;

      lead = await this.service.update(existingLead.id, {
        message: updatedMessage,
        classification: classification.label,
        status: 'new',
        aiReply: classification.suggestedReply,
      } as any);
    } else {
      lead = await this.service.create({
        tenantId,
        userId: tenant.ownerId,
        name: body.name ?? 'Unknown',
        email: body.email ?? '',
        source: 'contact_form',
        message: body.message,
        classification: classification.label,
        status: 'new',
        aiReply: classification.suggestedReply,
      } as any);
    }

    return { ok: true, leadId: lead.id, ai_reply: classification.suggestedReply };
  }

  @Get('contact-form/:tenantId/config')
  async getContactFormConfig(@Param('tenantId', new ParseUUIDPipe()) tenantId: string) {
    if (!tenantId) {
      throw new UnauthorizedException('tenantId is required');
    }

    let brandProfile = null;
    try {
      const profiles = await this.brandProfiles.findForTenant(tenantId);
      brandProfile = profiles?.[0] || null;
    } catch {
      // Ignore
    }

    let chatbotConfig = null;
    try {
      chatbotConfig = await this.chatbotConfig.getOrCreate(tenantId);
    } catch {
      // Ignore
    }

    return {
      brandProfile: brandProfile
        ? {
            companyName: brandProfile.companyName,
            toneOfVoice: brandProfile.toneOfVoice,
            description: brandProfile.description,
          }
        : null,
      chatbotConfig: chatbotConfig
        ? {
            name: chatbotConfig.name,
            welcomeMessage: chatbotConfig.welcomeMessage,
            widgetTheme: chatbotConfig.widgetTheme,
          }
        : null,
    };
  }

  @Post('send-email')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async sendEmail(
    @Req() req: { user: JwtUser },
    @Body() body: SendLeadEmailDto,
  ) {
    const payload = await this.leadEmail.prepareSend(
      body,
      String(req.user.sub),
    );

    if (this.queueDispatch.isEnabled()) {
      const { jobId, queue } = await this.queueDispatch.enqueueEmail(payload);
      return { queued: true, jobId, queue };
    }
    return this.leadEmail.sendLeadEmail(payload);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  create(@Body() dto: LeadsCreateDto): Promise<Leads> {
    return this.service.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('workspaceId') workspaceId?: string,
  ): Promise<Leads[]> {
    return this.service.findAll(tenantId, workspaceId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  findOne(@Param('id') id: string): Promise<Leads> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() dto: LeadsUpdateDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
