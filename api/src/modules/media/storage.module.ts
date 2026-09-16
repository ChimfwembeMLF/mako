import { Global, Module, forwardRef } from '@nestjs/common';
import { SystemSettingsModule } from '../system_settings/system_settings.module';
import { S3StorageService } from './s3-storage.service';

@Global()
@Module({
  imports: [forwardRef(() => SystemSettingsModule)],
  providers: [S3StorageService],
  exports: [S3StorageService],
})
export class StorageModule {}
