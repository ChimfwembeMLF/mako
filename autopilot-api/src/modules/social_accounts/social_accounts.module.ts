import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SocialAccounts } from './entities/social_accounts.entity';
import { SocialAccountsService } from './social_accounts.service';
import { SocialAccountsController } from './social_accounts.controller';
import { SocialAccountsOAuthService } from './social_accounts-oauth.service';
import { TenantMembersModule } from '../tenant_members/tenant_members.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SocialAccounts]),
    TenantMembersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'default_secret',
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  providers: [SocialAccountsService, SocialAccountsOAuthService],
  controllers: [SocialAccountsController],
  exports: [SocialAccountsService],
})
export class SocialAccountsModule {}
