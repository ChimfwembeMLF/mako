import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaAssets } from '../content_items/entities/media_assets.entity';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { StorageModule } from './storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([MediaAssets]), StorageModule],
  providers: [MediaService],
  controllers: [MediaController],
  exports: [MediaService, StorageModule],
})
export class MediaModule {}
