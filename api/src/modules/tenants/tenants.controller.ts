import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { TenantsService } from './tenants.service';
import { Tenants } from './entities/tenants.entity';
import { TenantsCreateDto } from './dto/create-tenants.dto';
import { TenantsUpdateDto } from './dto/update-tenants.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IntegrationProvider } from './entities/tenant-integration-config.entity';
import { TenantAccessService } from '../auth/rbac/tenant-access.service';

@ApiTags('Tenants')
@Controller('api/v1/tenants')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TenantsController {
  constructor(
    private readonly service: TenantsService,
    private readonly access: TenantAccessService,
  ) {}

  @Post()
  async create(@Req() req: Request, @Body() dto: TenantsCreateDto): Promise<Tenants> {
    await this.access.assertSuperAdmin(req.user?.['sub']);
    return this.service.create(dto);
  }

  @Get('mine')
  findMine(@Req() req: Request): Promise<Tenants[]> {
    const userId = req.user?.['sub'];
    return this.service.findForUserEnsuringBootstrap(userId);
  }

  @Get()
  async findAll(@Req() req: Request): Promise<Tenants[]> {
    await this.access.assertSuperAdmin(req.user?.['sub']);
    return this.service.findAll();
  }

  @Get(':id')
  async findOne(@Req() req: Request, @Param('id') id: string): Promise<Tenants> {
    await this.access.assertMember(req.user?.['sub'], id);
    return this.service.findOne(id);
  }

  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: TenantsUpdateDto,
  ) {
    const userId = req.user?.['sub'];
    if (dto.preferredAiProvider === IntegrationProvider.GOOGLE_DRIVE) {
      throw new BadRequestException('Google Drive is not an AI provider');
    }
    await this.access.assertMember(
      userId,
      id,
      dto.preferredAiProvider !== undefined ? 'settings.billing' : 'settings.view',
    );
    if (dto.ownerId !== undefined) await this.access.assertSuperAdmin(userId);
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    await this.access.assertSuperAdmin(req.user?.['sub']);
    return this.service.remove(id);
  }
}
