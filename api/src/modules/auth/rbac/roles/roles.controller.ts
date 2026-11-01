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
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { Roles } from './entities/roles.entity';
import { RolesCreateDto } from './dto/create-roles.dto';
import { RolesUpdateDto } from './dto/update-roles.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { TenantAccessService } from '../tenant-access.service';

type AuthedRequest = { user: { sub: string } };

@ApiTags('Roles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('api/v1/roles')
export class RolesController {
  constructor(
    private readonly service: RolesService,
    private readonly access: TenantAccessService,
  ) {}

  @Post()
  async create(@Req() req: AuthedRequest, @Body() dto: RolesCreateDto): Promise<Roles> {
    await this.access.assertMember(req.user.sub, dto.tenantId, 'admin.roles');
    if (dto.isSystem) await this.access.assertSuperAdmin(req.user.sub);
    return this.service.create(dto);
  }

  @Get()
  async findAll(
    @Req() req: AuthedRequest,
    @Query('tenantId') tenantId?: string,
  ): Promise<Roles[]> {
    if (!tenantId) await this.access.assertSuperAdmin(req.user.sub);
    return this.service.findAll(tenantId);
  }

  @Get(':id')
  async findOne(@Req() req: AuthedRequest, @Param('id') id: string): Promise<Roles> {
    const role = await this.service.findOne(id);
    await this.access.assertMember(req.user.sub, role.tenantId);
    return role;
  }

  @Patch(':id')
  async update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: RolesUpdateDto,
  ) {
    await this.access.assertCanManageRole(req.user.sub, id);
    if (dto.isSystem !== undefined) await this.access.assertSuperAdmin(req.user.sub);
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.access.assertCanManageRole(req.user.sub, id);
    return this.service.remove(id);
  }
}
