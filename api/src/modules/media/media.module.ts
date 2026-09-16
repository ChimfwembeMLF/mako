import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaAssets } from '../content_items/entities/media_assets.entity';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { StorageModule } from './storage.module';
import { GoogleDriveService } from './google-drive.service';
import { GoogleDriveController } from './google-drive.controller';
import { TenantsModule } from '../tenants/tenants.module';
import { TenantIntegrationConfig } from '../tenants/entities/tenant-integration-config.entity';
import { SystemSettingsModule } from '../system_settings/system_settings.module';

@Module({
  imports: [SystemSettingsModule, TypeOrmModule.forFeature([MediaAssets, TenantIntegrationConfig]), StorageModule, TenantsModule],
  providers: [MediaService, GoogleDriveService],
  controllers: [MediaController, GoogleDriveController],
  exports: [MediaService, StorageModule, GoogleDriveService],
})
export class MediaModule {}
