import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentCampaigns } from './entities/content_campaigns.entity';
import { ContentItems } from '../content_items/entities/content_items.entity';
import { BrandProfilesModule } from '../brand_profiles/brand_profiles.module';
import { ContentCampaignsController } from './content-campaigns.controller';
import { GenerateCampaignService } from './services/generate-campaign.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContentCampaigns, ContentItems]),
    AiModule,
    BrandProfilesModule,
  ],
  controllers: [ContentCampaignsController],
  providers: [GenerateCampaignService],
  exports: [GenerateCampaignService],
})
export class ContentCampaignsModule {}
