import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BrandProfiles } from './entities/brand_profiles.entity';
import { BrandProfilesService } from './brand_profiles.service';
import { BrandProfilesController } from './brand_profiles.controller';
import { AiModule } from '../ai/ai.module';
import { ScrapeWebsiteService } from './services/scrape-website.service';
import { ParseDocumentService } from './services/parse-document.service';
import { BrandProfileSeedService } from './brand-profile-seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([BrandProfiles]), AiModule],
  providers: [BrandProfilesService, ScrapeWebsiteService, ParseDocumentService, BrandProfileSeedService],
  controllers: [BrandProfilesController],
  exports: [BrandProfilesService, BrandProfileSeedService, ParseDocumentService],
})
export class BrandProfilesModule {}
