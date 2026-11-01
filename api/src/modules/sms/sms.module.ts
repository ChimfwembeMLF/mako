import { Module } from '@nestjs/common';
import { SystemSettingsModule } from '../system_settings/system_settings.module';
import { SmsService } from './sms.service';

@Module({
  imports: [SystemSettingsModule],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
