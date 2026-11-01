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
import { ProfilesService } from './profiles.service';
import { Profiles } from './entities/profiles.entity';
import { ProfilesCreateDto } from './dto/create-profiles.dto';
import { ProfilesUpdateDto } from './dto/update-profiles.dto';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../auth/rbac/platform-admin.guard';
import { TenantAccessService } from '../auth/rbac/tenant-access.service';

type AuthedRequest = { user: { sub: string } };

@ApiTags('Profiles')
@UseGuards(JwtAuthGuard)
@Controller('api/v1/profiles')
export class ProfilesController {
  constructor(
    private readonly service: ProfilesService,
    private readonly access: TenantAccessService,
  ) {}

  @UseGuards(PlatformAdminGuard)
  @Post()
  create(@Body() dto: ProfilesCreateDto): Promise<Profiles> {
    return this.service.create(dto);
  }

  @Get()
  async findAll(
    @Req() req: AuthedRequest,
    @Query('userId') userId?: string,
  ): Promise<Profiles[]> {
    if (userId) await this.access.assertCanViewUser(req.user.sub, userId);
    else await this.access.assertSuperAdmin(req.user.sub);
    return this.service.findAll(userId);
  }

  @Get(':id')
  async findOne(@Req() req: AuthedRequest, @Param('id') id: string): Promise<Profiles> {
    const profile = await this.service.findOne(id);
    await this.access.assertCanViewUser(req.user.sub, profile.userId);
    return profile;
  }

  @Patch(':id')
  async update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: ProfilesUpdateDto,
  ) {
    const profile = await this.service.findOne(id);
    const changesAccess = dto.isSystemAdmin !== undefined || dto.userId !== undefined;
    if (profile.userId !== req.user.sub || changesAccess) {
      await this.access.assertSuperAdmin(req.user.sub);
    }
    return this.service.update(id, dto);
  }

  @UseGuards(PlatformAdminGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
