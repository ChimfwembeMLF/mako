import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { XWebhookAdminService } from './x-webhook-admin.service';

/** Lightweight module for X webhook admin — avoids SocialInboxModule ↔ ContentPublishing cycle. */
@Module({
  imports: [TypeOrmModule.forFeature([SocialAccounts])],
  providers: [XWebhookAdminService],
  exports: [XWebhookAdminService],
})
export class XWebhookModule {}
