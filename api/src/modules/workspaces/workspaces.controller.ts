import { RequirePermission } from '../auth/rbac/require-permission.decorator';
import { TenantAccessService } from '../auth/rbac/tenant-access.service';
import { TenantResource } from '../auth/rbac/tenant-resource.decorator';
import {
  ForbiddenException,
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
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { WorkspacesService } from './workspaces.service';
import { Workspaces } from './entities/workspaces.entity';
import { WorkspacesCreateDto } from './dto/create-workspaces.dto';
import { WorkspacesUpdateDto } from './dto/update-workspaces.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceAutomationConfig } from './entities/workspace-automation-config.entity';
import { UpdateAutomationConfigDto } from './dto/update-automation-config.dto';

interface JwtUser {
  sub: string;
}

@ApiTags('Workspaces')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@TenantResource(Workspaces)
@Controller('api/v1/workspaces')
export class WorkspacesController {
  constructor(
    private readonly service: WorkspacesService,
    private readonly access: TenantAccessService,
  ) {}

  @RequirePermission('settings.billing')
  @Post()
  async create(
    @Req() req: { user: JwtUser },
    @Body() dto: WorkspacesCreateDto,
  ): Promise<Workspaces> {
    // A member limited to some workspaces would be locked out of a new one.
    if (await this.access.allowedWorkspaceIds(String(req.user.sub), dto.tenantId)) {
      throw new ForbiddenException('Only members with access to every workspace can create workspaces');
    }
    return this.service.create(dto, String(req.user.sub));
  }

  @Get()
  async list(
    @Req() req: { user: { sub: string } },
    @Query('tenantId') tenantId?: string,
  ): Promise<Workspaces[]> {
    const userId = req.user.sub;
    const all = tenantId
      ? await this.service.findAll(tenantId)
      : await this.service.findForTenants(await this.access.memberTenantIds(userId));
    // Members limited to some workspaces only see those.
    const allowedByTenant = new Map<string, string[] | null>();
    for (const t of new Set(all.map((w) => w.tenantId))) {
      allowedByTenant.set(t, await this.access.allowedWorkspaceIds(userId, t));
    }
    return all.filter((w) => {
      const allowed = allowedByTenant.get(w.tenantId);
      return !allowed || allowed.includes(w.id);
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Workspaces> {
    return this.service.findOne(id);
  }

  @RequirePermission('settings.brand_brain')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: WorkspacesUpdateDto) {
    return this.service.update(id, dto);
  }

  @RequirePermission('settings.billing')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Get(':id/automation-config')
  getAutomationConfig(@Param('id') id: string): Promise<WorkspaceAutomationConfig> {
    return this.service.getAutomationConfig(id);
  }

  @RequirePermission('settings.brand_brain')
  @Patch(':id/automation-config')
  updateAutomationConfig(
    @Param('id') id: string,
    @Body() payload: UpdateAutomationConfigDto,
  ): Promise<WorkspaceAutomationConfig> {
    return this.service.updateAutomationConfig(id, payload);
  }
}
