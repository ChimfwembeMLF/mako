import {
  BadRequestException,
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
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { TenantAccessService } from '../tenant-access.service';
import { RolePermissionsService } from './role_permissions.service';
import { RolePermissions } from './entities/role_permissions.entity';
import { RolePermissionsCreateDto } from './dto/create-role_permissions.dto';
import { RolePermissionsUpdateDto } from './dto/update-role_permissions.dto';

type AuthedRequest = { user: { sub: string } };

@UseGuards(JwtAuthGuard)
@Controller('api/v1/role-permissions')
export class RolePermissionsController {
  constructor(
    private readonly service: RolePermissionsService,
    private readonly access: TenantAccessService,
  ) {}

  @Post()
  async create(
    @Req() req: AuthedRequest,
    @Body() dto: RolePermissionsCreateDto,
  ): Promise<RolePermissions> {
    await this.access.assertCanManageRole(req.user.sub, dto.roleId, dto.permissionKey);
    return this.service.create(dto);
  }

  @Get()
  findAll(): Promise<RolePermissions[]> {
    return this.service.findAll();
  }

  @Get(':roleId/:permissionKey')
  findOne(
    @Param('roleId') roleId: string,
    @Param('permissionKey') permissionKey: string,
  ): Promise<RolePermissions> {
    return this.service.findOne(roleId, permissionKey);
  }

  @Patch(':roleId/:permissionKey')
  async update(
    @Req() req: AuthedRequest,
    @Param('roleId') roleId: string,
    @Param('permissionKey') permissionKey: string,
    @Body() dto: RolePermissionsUpdateDto,
  ) {
    await this.access.assertCanManageRole(req.user.sub, roleId, permissionKey);
    await this.access.assertCanGrant(req.user.sub, dto.permissionKey);
    if (dto.roleId && dto.roleId !== roleId) {
      await this.access.assertCanManageRole(req.user.sub, dto.roleId, dto.permissionKey);
    }
    return this.service.update(roleId, permissionKey, dto);
  }

  @Delete(':roleId')
  async remove(
    @Req() req: AuthedRequest,
    @Param('roleId') roleId: string,
    @Query('permissionKey') permissionKey: string,
  ) {
    if (!permissionKey) {
      throw new BadRequestException('permissionKey query param is required');
    }
    await this.access.assertCanManageRole(req.user.sub, roleId);
    return this.service.remove(roleId, permissionKey);
  }
}
