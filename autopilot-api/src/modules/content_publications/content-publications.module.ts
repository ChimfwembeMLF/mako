import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentPublications } from './entities/content_publications.entity';
import { ContentPublicationsService } from './content-publications.service';
import { EngagementInsightsService } from './engagement-insights.service';
import { ContentPublicationsController } from './content-publications.controller';
import { ContentPublishingModule } from '../content-publishing/content-publishing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContentPublications]),
    ContentPublishingModule,
  ],
  providers: [ContentPublicationsService, EngagementInsightsService],
  controllers: [ContentPublicationsController],
  exports: [ContentPublicationsService, EngagementInsightsService],
})
export class ContentPublicationsModule {}
