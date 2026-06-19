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
  constructor(private readonly service: TenantMembersService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('invite')
  invite(@Req() req: Request, @Body() dto: InviteMemberDto) {
    const userId = req.user?.['sub'];
    return this.service.invite({ ...dto, invitedBy: userId });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  create(@Body() dto: TenantMembersCreateDto): Promise<TenantMembers> {
    return this.service.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get()
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('detailed') detailed?: string,
  ) {
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
  findOne(@Param('id') id: string): Promise<TenantMembers> {
    return this.service.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: TenantMembersUpdateDto) {
    return this.service.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('invitations/:id')
  revokeInvitation(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ) {
    return this.service.revokeInvitation(id, tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
