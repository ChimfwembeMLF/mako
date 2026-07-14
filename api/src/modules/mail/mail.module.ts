import { Module, forwardRef } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { AutoReplyRulesModule } from '../auto_reply_rules/auto_reply_rules.module';
import { BrandProfiles } from '../brand_profiles/entities/brand_profiles.entity';
import { TenantMembers } from '../tenant_members/entities/tenant_members.entity';
import { Tenants } from '../tenants/entities/tenants.entity';
import { UserEntity } from '../user/user.entity';
import { UserModule } from '../user/user.module';
import { GmailInboxConnection } from './entities/gmail_inbox_connection.entity';
import { MailMessages } from './entities/mail_messages.entity';
import { GmailAutoReplyService } from './gmail-auto-reply.service';
import { GmailClientService } from './gmail-client.service';
import { GmailConnectService } from './gmail-connect.service';
import { GmailInboxSyncService } from './gmail-inbox-sync.service';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';

@Module({
  imports: [
    UserModule,
    forwardRef(() => AuthModule),
    AiModule,
    AutoReplyRulesModule,
    TypeOrmModule.forFeature([
      GmailInboxConnection,
      MailMessages,
      BrandProfiles,
      Tenants,
      UserEntity,
      TenantMembers,
    ]),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get<string>('MAIL_HOST', 'smtp.mailgun.org'),
          port: config.get<number>('MAIL_PORT', 587),
          secure: false,
          auth: {
            user: config.get<string>('MAIL_USERNAME'),
            pass: config.get<string>('MAIL_PASSWORD'),
          },
        },
        defaults: {
          from: config.get<string>('MAIL_FROM', 'noreply@brandpilot.app'),
        },
      }),
    }),
  ],
  controllers: [MailController],
  providers: [
    MailService,
    GmailConnectService,
    GmailClientService,
    GmailAutoReplyService,
    GmailInboxSyncService,
  ],
  exports: [MailService, GmailInboxSyncService, GmailClientService],
})
export class MailModule {}
