import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocialAccounts } from './entities/social_accounts.entity';
import { SocialAccountsService } from './social_accounts.service';
import { SocialAccountsController } from './social_accounts.controller';
import { SocialAccountsOAuthService } from './social_accounts-oauth.service';
import { TenantMembersModule } from '../tenant_members/tenant_members.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SocialAccounts]),
    TenantMembersModule,
  ],
  providers: [SocialAccountsService, SocialAccountsOAuthService],
  controllers: [SocialAccountsController],
  exports: [SocialAccountsService],
})
export class SocialAccountsModule {}
