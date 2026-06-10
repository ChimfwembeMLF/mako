import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentPublications } from './entities/content_publications.entity';
import { ContentPublicationsService } from './content-publications.service';
import { ContentPublicationsController } from './content-publications.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ContentPublications])],
  providers: [ContentPublicationsService],
  controllers: [ContentPublicationsController],
  exports: [ContentPublicationsService],
})
export class ContentPublicationsModule {}
