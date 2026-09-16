import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemSettings } from './entities/system_settings.entity';
import { SystemSettingsService } from './system_settings.service';
import { SystemSettingsController } from './system_settings.controller';
import { PlatformIntegrationsService } from './services/platform-integrations.service';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [TypeOrmModule.forFeature([SystemSettings]), TenantsModule],
  providers: [SystemSettingsService, PlatformIntegrationsService],
  controllers: [SystemSettingsController],
  exports: [SystemSettingsService, PlatformIntegrationsService],
})
export class SystemSettingsModule {}
