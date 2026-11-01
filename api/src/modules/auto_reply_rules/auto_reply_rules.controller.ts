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
} from '@nestjs/common';
import { AutoReplyRulesService } from './auto_reply_rules.service';
import { AutoReplyRules } from './entities/auto_reply_rules.entity';
import { AutoReplyRulesCreateDto } from './dto/create-auto_reply_rules.dto';
import { AutoReplyRulesUpdateDto } from './dto/update-auto_reply_rules.dto';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantAccessService } from '../auth/rbac/tenant-access.service';

type AuthedRequest = { user: { sub: string } };

const MANAGE = 'replies.manage_rules';

@ApiTags('Auto Reply Rules')
@UseGuards(JwtAuthGuard)
@Controller('api/v1/auto-reply-rules')
export class AutoReplyRulesController {
  constructor(
    private readonly service: AutoReplyRulesService,
    private readonly access: TenantAccessService,
  ) {}

  @Post()
  async create(
    @Req() req: AuthedRequest,
    @Body() dto: AutoReplyRulesCreateDto,
  ): Promise<AutoReplyRules> {
    await this.access.assertMember(req.user.sub, dto.tenantId, MANAGE);
    return this.service.create(dto);
  }

  @Get()
  async findAll(
    @Req() req: AuthedRequest,
    @Query('tenantId') tenantId?: string,
    @Query('workspaceId') workspaceId?: string,
  ): Promise<AutoReplyRules[]> {
    if (!tenantId) await this.access.assertSuperAdmin(req.user.sub);
    return this.service.findAll(tenantId, workspaceId);
  }

  @Get(':id')
  async findOne(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
  ): Promise<AutoReplyRules> {
    const rule = await this.service.findOne(id);
    await this.access.assertMember(req.user.sub, rule.tenantId);
    return rule;
  }

  @Patch(':id')
  async update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: AutoReplyRulesUpdateDto,
  ) {
    const rule = await this.service.findOne(id);
    await this.access.assertMember(req.user.sub, rule.tenantId, MANAGE);
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    const rule = await this.service.findOne(id);
    await this.access.assertMember(req.user.sub, rule.tenantId, MANAGE);
    return this.service.remove(id);
  }
}
