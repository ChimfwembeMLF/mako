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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { Leads } from './entities/leads.entity';
import { LeadsCreateDto } from './dto/create-leads.dto';
import { LeadsUpdateDto } from './dto/update-leads.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LeadClassifyService } from './services/lead-classify.service';
import { LeadEmailService } from './services/lead-email.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadSources } from '../lead_sources/entities/lead_sources.entity';
import { QueueDispatchService } from '../queues/queue-dispatch.service';

interface JwtUser {
  sub: string;
}

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

  @Post('send-email')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async sendEmail(@Body() body: { to: string; subject: string; body: string }) {
    if (this.queueDispatch.isEnabled()) {
      const { jobId, queue } = await this.queueDispatch.enqueueEmail(body);
      return { queued: true, jobId, queue };
    }
    return this.leadEmail.sendLeadEmail(body);
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
