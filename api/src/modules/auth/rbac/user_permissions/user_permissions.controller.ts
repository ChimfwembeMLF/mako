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
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { UserPermissionsService } from './user_permissions.service';
import { UserPermissions } from './entities/user_permissions.entity';
import { UserPermissionsCreateDto } from './dto/create-user_permissions.dto';
import { UserPermissionsUpdateDto } from './dto/update-user_permissions.dto';
import { TenantAccessService } from '../tenant-access.service';

type AuthedRequest = { user: { sub: string } };

const ASSIGN = 'team.assign_permissions';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/user-permissions')
export class UserPermissionsController {
  constructor(
    private readonly service: UserPermissionsService,
    private readonly access: TenantAccessService,
  ) {}

  @Post()
  async create(
    @Req() req: AuthedRequest,
    @Body() dto: UserPermissionsCreateDto,
  ): Promise<UserPermissions> {
    await this.access.assertMember(req.user.sub, dto.tenantId, ASSIGN);
    await this.access.assertCanGrant(req.user.sub, dto.permissionKey);
    return this.service.create(dto);
  }

  @Get()
  async findAll(
    @Req() req: AuthedRequest,
    @Query('tenantId') tenantId?: string,
    @Query('userId') userId?: string,
  ): Promise<UserPermissions[]> {
    if (!tenantId) await this.access.assertSuperAdmin(req.user.sub);
    return this.service.findAll(tenantId, userId);
  }

  @Get(':id')
  async findOne(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
  ): Promise<UserPermissions> {
    const entry = await this.service.findOne(id);
    await this.access.assertMember(req.user.sub, entry.tenantId);
    return entry;
  }

  @Patch(':id')
  async update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: UserPermissionsUpdateDto,
  ) {
    const entry = await this.service.findOne(id);
    await this.access.assertMember(req.user.sub, entry.tenantId, ASSIGN);
    await this.access.assertCanGrant(req.user.sub, dto.permissionKey);
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    const entry = await this.service.findOne(id);
    await this.access.assertMember(req.user.sub, entry.tenantId, ASSIGN);
    return this.service.remove(id);
  }
}
