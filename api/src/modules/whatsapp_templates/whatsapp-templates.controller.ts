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
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WhatsappTemplatesService } from './whatsapp-templates.service';
import { CreateWhatsappTemplateDto } from './dto/create-whatsapp-template.dto';
import { UpdateWhatsappTemplateDto } from './dto/update-whatsapp-template.dto';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { WhatsappMessagingService } from '../whatsapp/whatsapp-messaging.service';
import { scopeWhere } from '../../common/workspace-scope.util';

interface JwtUser {
  sub: string;
}

@ApiTags('WhatsApp Templates')
@Controller('api/v1/whatsapp/templates')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WhatsappTemplatesController {
  constructor(
    private readonly templates: WhatsappTemplatesService,
    private readonly messaging: WhatsappMessagingService,
    @InjectRepository(SocialAccounts)
    private readonly socialRepo: Repository<SocialAccounts>,
  ) {}

  // ─── Resolve credentials helper ───────────────────────────────────────────

  private async resolveCreds(
    tenantId: string,
    userId: string,
    workspaceId?: string,
  ) {
    const account =
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
      }));

    if (!account) {
      throw new BadRequestException(
        'No connected WhatsApp account found for this workspace.',
      );
    }
    const creds = this.messaging.credentialsFromAccount(account);
    if (!creds) {
      throw new BadRequestException(
        'WhatsApp credentials are missing — reconnect WhatsApp in Publisher Connect.',
      );
    }
    return creds;
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all saved WhatsApp templates for a tenant' })
  list(
    @Query('tenantId') tenantId: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    return this.templates.findByTenant(tenantId, workspaceId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new DRAFT WhatsApp template' })
  create(@Body() dto: CreateWhatsappTemplateDto) {
    return this.templates.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a DRAFT or REJECTED template' })
  update(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
    @Body() dto: UpdateWhatsappTemplateDto,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    return this.templates.update(id, dto, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a DRAFT or REJECTED template' })
  remove(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    return this.templates.remove(id, tenantId);
  }

  // ─── Meta Actions ─────────────────────────────────────────────────────────

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit a DRAFT template to Meta for approval' })
  async submit(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
    @Query('workspaceId') workspaceId: string | undefined,
    @Req() req: { user: JwtUser },
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    const creds = await this.resolveCreds(tenantId, String(req.user.sub), workspaceId);
    return this.templates.submit(id, tenantId, creds);
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Pull latest approval status from Meta for one template' })
  async syncOne(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
    @Query('workspaceId') workspaceId: string | undefined,
    @Req() req: { user: JwtUser },
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    const creds = await this.resolveCreds(tenantId, String(req.user.sub), workspaceId);
    return this.templates.syncStatus(id, tenantId, creds);
  }

  @Post('sync-all')
  @ApiOperation({ summary: 'Sync all PENDING/APPROVED templates from Meta' })
  async syncAll(
    @Query('tenantId') tenantId: string,
    @Query('workspaceId') workspaceId: string | undefined,
    @Req() req: { user: JwtUser },
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    const creds = await this.resolveCreds(tenantId, String(req.user.sub), workspaceId);
    return this.templates.syncAll(tenantId, creds, workspaceId);
  }

  @Get('meta')
  @ApiOperation({ summary: 'Fetch templates directly from Meta WABA (for import)' })
  async listFromMeta(
    @Query('tenantId') tenantId: string,
    @Query('workspaceId') workspaceId: string | undefined,
    @Req() req: { user: JwtUser },
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    const creds = await this.resolveCreds(tenantId, String(req.user.sub), workspaceId);
    return this.templates.listFromMeta(creds);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import an already-approved Meta template into local registry' })
  async importFromMeta(
    @Query('tenantId') tenantId: string,
    @Query('workspaceId') workspaceId: string | undefined,
    @Req() req: { user: JwtUser },
    @Body()
    body: {
      metaId: string;
      name: string;
      language: string;
      status: string;
      category?: string;
      components: any[];
    },
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    return this.templates.importFromMeta(tenantId, workspaceId, body);
  }
}
