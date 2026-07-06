import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenants } from '../tenants/entities/tenants.entity';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { AdCampaignEntity } from './entities/ad-campaign.entity';
import { AdCreativeEntity } from './entities/ad-creative.entity';
import { AdsService } from './services/ads.service';
import { AdsAccountService } from './services/ads-account.service';
import { MetaAdsAdapter } from './adapters/meta-ads.adapter';
import { GoogleAdsAdapter } from './adapters/google-ads.adapter';
import { EmbedAdsAdapter } from './adapters/embed-ads.adapter';
import { TiktokAdsAdapter } from './adapters/tiktok-ads.adapter';
import { LinkedinAdsAdapter } from './adapters/linkedin-ads.adapter';
import { PinterestAdsAdapter } from './adapters/pinterest-ads.adapter';
import { TaboolaAdsAdapter } from './adapters/taboola-ads.adapter';
import { XAdsAdapter } from './adapters/x-ads.adapter';
import { AdsController } from './ads.controller';
import { EmbedAdsController } from './embed-ads.controller';
import { SocialAccountsModule } from '../social_accounts/social_accounts.module';
import { AiModule } from '../ai/ai.module';
import { TenantMembersModule } from '../tenant_members/tenant_members.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdCampaignEntity,
      AdCreativeEntity,
      Tenants,
      SocialAccounts,
    ]),
    SocialAccountsModule,
    AiModule,
    TenantMembersModule,
  ],
  controllers: [AdsController, EmbedAdsController],
  providers: [
    AdsService,
    AdsAccountService,
    MetaAdsAdapter, 
    GoogleAdsAdapter, 
    EmbedAdsAdapter,
    TiktokAdsAdapter,
    LinkedinAdsAdapter,
    PinterestAdsAdapter,
    TaboolaAdsAdapter,
    XAdsAdapter
  ],
  exports: [AdsService],
})
export class AdsModule {}
