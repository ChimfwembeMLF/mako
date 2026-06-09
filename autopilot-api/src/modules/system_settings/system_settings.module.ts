import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemSettings } from './entities/system_settings.entity';
import { SystemSettingsService } from './system_settings.service';
import { SystemSettingsController } from './system_settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SystemSettings])],
  providers: [SystemSettingsService],
  controllers: [SystemSettingsController],
  exports: [SystemSettingsService],
})
export class SystemSettingsModule {}
