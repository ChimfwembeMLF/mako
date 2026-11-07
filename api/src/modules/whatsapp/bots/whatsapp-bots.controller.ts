import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantAccessService } from '../../auth/rbac/tenant-access.service';
import { TenantResource } from '../../auth/rbac/tenant-resource.decorator';
import { WhatsappBot } from './whatsapp-bot.entity';
import { WhatsappBotsService } from './whatsapp-bots.service';
import type { BotGraph } from './whatsapp-bot.types';
import { redactActionSecrets } from './whatsapp-bot-secrets';

/** What the browser sees: never the custom-action secrets. */
function view(bot: WhatsappBot): WhatsappBot {
  return { ...bot, graph: redactActionSecrets(bot.graph) } as WhatsappBot;
}
import type { BotSessionState } from './whatsapp-bot-runner';

class CreateBotDto {
  @IsUUID() tenantId: string;
  @IsOptional() @IsUUID() workspaceId?: string;
  @IsString() @MaxLength(80) name: string;
  @IsOptional() @IsIn(['blank', 'menu', 'agent', 'lead_capture', 'from_menu_bot'])
  template?: 'blank' | 'menu' | 'agent' | 'lead_capture' | 'from_menu_bot';
}

class UpdateBotDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) triggers?: string[];
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsObject() graph?: BotGraph;
}

class TestBotDto {
  @IsString() @MaxLength(1000) text: string;
  @IsOptional() @IsString() interactiveId?: string;
  @IsOptional() @IsObject() graph?: BotGraph;
  @IsOptional() @IsObject() state?: BotSessionState;
}

type AuthedRequest = { user: { sub: string } };

/** Visual WhatsApp bots. Managing them needs the chatbot "manage" permission. */
@ApiTags('WhatsApp bots')
@ApiBearerAuth()
@Controller('api/v1/whatsapp/bots')
@UseGuards(JwtAuthGuard)
export class WhatsappBotsController {
  constructor(
    private readonly bots: WhatsappBotsService,
    private readonly access: TenantAccessService,
  ) {}

  private async loadForUser(req: AuthedRequest, id: string, permission = 'chatbot.manage'): Promise<WhatsappBot> {
    const bot = await this.bots.get(id);
    await this.access.assertMember(req.user.sub, bot.tenantId, permission);
    return bot;
  }

  @Get()
  async list(@Req() req: AuthedRequest, @Query('tenantId') tenantId: string, @Query('workspaceId') workspaceId?: string) {
    await this.access.assertMember(req.user.sub, tenantId, 'chatbot.view');
    return (await this.bots.list(tenantId, workspaceId)).map(view);
  }

  @Post()
  async create(@Req() req: AuthedRequest, @Body() dto: CreateBotDto) {
    await this.access.assertMember(req.user.sub, dto.tenantId, 'chatbot.manage');
    return view(await this.bots.create({ ...dto, userId: req.user.sub }));
  }

  @Get(':id')
  @TenantResource(WhatsappBot)
  async get(@Req() req: AuthedRequest, @Param('id') id: string) {
    return view(await this.loadForUser(req, id, 'chatbot.view'));
  }

  @Patch(':id')
  @TenantResource(WhatsappBot)
  async update(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: UpdateBotDto) {
    await this.loadForUser(req, id);
    const { bot, problems } = await this.bots.update(id, dto);
    return { bot: view(bot), problems };
  }

  @Post(':id/publish')
  @TenantResource(WhatsappBot)
  async publish(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.loadForUser(req, id);
    return view(await this.bots.publish(id));
  }

  @Post(':id/unpublish')
  @TenantResource(WhatsappBot)
  async unpublish(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.loadForUser(req, id);
    return view(await this.bots.unpublish(id));
  }

  @Delete(':id')
  @HttpCode(204)
  @TenantResource(WhatsappBot)
  async remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.loadForUser(req, id);
    await this.bots.remove(id);
  }

  @Post(':id/test')
  @HttpCode(200)
  @TenantResource(WhatsappBot)
  async test(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: TestBotDto) {
    const bot = await this.loadForUser(req, id);
    return this.bots.simulate({ bot, graph: dto.graph, state: dto.state, text: dto.text, interactiveId: dto.interactiveId, userId: req.user.sub });
  }
}
