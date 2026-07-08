import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TemplatesService } from './templates.service';

interface JwtUser {
  sub: string;
}

@ApiTags('Templates')
@Controller('api/v1/templates')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  findAll(
    @Query('tenantId') tenantId: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    return this.templates.findByTenant(tenantId, workspaceId);
  }

  @Post()
  create(@Req() req: { user: JwtUser }, @Body() body: Record<string, unknown>) {
    return this.templates.create({
      ...body,
      userId: String(req.user.sub),
    } as any);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    return this.templates.findOne(id, tenantId, workspaceId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
    @Body() body: Record<string, unknown>,
    @Query('workspaceId') workspaceId?: string,
  ) {
    return this.templates.update(id, body as any, tenantId, workspaceId);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    return this.templates.remove(id, tenantId, workspaceId);
  }
}
