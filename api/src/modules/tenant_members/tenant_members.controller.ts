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
import { Request } from 'express';
import { TenantAccessService } from '../auth/rbac/tenant-access.service';
import { TenantMembersService } from './tenant_members.service';
import { TenantMembers } from './entities/tenant_members.entity';
import { TenantMembersCreateDto } from './dto/create-tenant_members.dto';
import { TenantMembersUpdateDto } from './dto/update-tenant_members.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsEmail, IsUUID } from 'class-validator';

class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsUUID()
  tenantId: string;

  @IsUUID()
  roleId: string;
}

@ApiTags('Tenant Members')
@Controller('api/v1/tenant-members')
export class TenantMembersController {
  constructor(
    private readonly service: TenantMembersService,
    private readonly access: TenantAccessService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('invite')
  async invite(@Req() req: Request, @Body() dto: InviteMemberDto) {
    const userId = req.user?.['sub'];
    await this.access.assertMember(userId, dto.tenantId, 'team.invite');
    return this.service.invite({ ...dto, invitedBy: userId });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  async create(
    @Req() req: Request,
    @Body() dto: TenantMembersCreateDto,
  ): Promise<TenantMembers> {
    await this.access.assertMember(req.user?.['sub'], dto.tenantId, 'team.assign_roles');
    return this.service.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get()
  async findAll(
    @Req() req: Request,
    @Query('tenantId') tenantId?: string,
    @Query('detailed') detailed?: string,
  ) {
    if (!tenantId) await this.access.assertSuperAdmin(req.user?.['sub']);
    if (tenantId && detailed === 'true') {
      return this.service.listByTenant(tenantId);
    }
    return this.service.findAll(tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  findMine(@Req() req: Request) {
    return this.service.findForUser(req.user?.['sub']);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id')
  async findOne(@Req() req: Request, @Param('id') id: string): Promise<TenantMembers> {
    const member = await this.service.findOne(id);
    await this.access.assertMember(req.user?.['sub'], member.tenantId);
    return member;
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: TenantMembersUpdateDto,
  ) {
    const member = await this.service.findOne(id);
    await this.access.assertMember(req.user?.['sub'], member.tenantId, 'team.assign_roles');
    return this.service.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('invitations/:id')
  async revokeInvitation(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ) {
    await this.access.assertMember(req.user?.['sub'], tenantId, 'team.invite');
    return this.service.revokeInvitation(id, tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    const userId = req.user?.['sub'];
    const member = await this.service.findOne(id);
    // Anyone may leave; removing someone else takes the permission.
    await this.access.assertMember(
      userId,
      member.tenantId,
      member.userId === userId ? undefined : 'team.remove',
    );
    return this.service.remove(id);
  }
}
