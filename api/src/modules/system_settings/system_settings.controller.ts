import { PlatformAdminGuard } from '../auth/rbac/platform-admin.guard';
import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { SystemSettingsService } from './system_settings.service';
import { PlatformIntegrationsService } from './services/platform-integrations.service';
import { SystemSettingsUpsertDto } from './dto/upsert-system_settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/v1/system-settings')
export class SystemSettingsController {
  constructor(
    private readonly service: SystemSettingsService,
    private readonly integrations: PlatformIntegrationsService,
  ) {}

  @Get('theme')
  getTheme() {
    return this.service.getTheme();
  }

  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Get('integrations')
  async getIntegrations() {
    const keys = await this.integrations.getAllIntegrations();
    // Return masked values so the frontend knows which keys are set
    const masked: Record<string, string> = {};
    for (const k of Object.keys(keys)) {
      if (keys[k]) masked[k] = '********';
    }
    return masked;
  }

  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Put('integrations')
  async updateIntegrations(@Body() body: Record<string, string>) {
    await this.integrations.saveIntegrations(body);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Get(':key')
  findOne(@Param('key') key: string) {
    return this.service.findOne(key);
  }

  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Put(':key')
  upsert(@Param('key') key: string, @Body() dto: SystemSettingsUpsertDto) {
    return this.service.upsert(key, dto);
  }

  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Delete(':key')
  remove(@Param('key') key: string) {
    return this.service.remove(key);
  }
}
