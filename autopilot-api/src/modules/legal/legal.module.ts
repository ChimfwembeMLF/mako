import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataDeletionRequests } from './entities/data_deletion_requests.entity';
import { DataProtectionConsents } from './entities/data_protection_consents.entity';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { DataDeletionService } from './data-deletion.service';
import { DataProtectionConsentService } from './data-protection-consent.service';
import { LegalController } from './legal.controller';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { SocialInboxModule } from '../social_inbox/social-inbox.module';
import { QueuesModule } from '../queues/queues.module';

import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([DataDeletionRequests, DataProtectionConsents, SocialAccounts]),
    AuthModule,
    UserModule,
    WhatsappModule,
    SocialInboxModule,
    forwardRef(() => QueuesModule),
  ],
  providers: [DataDeletionService, DataProtectionConsentService, OptionalJwtAuthGuard],
  controllers: [LegalController],
  exports: [DataDeletionService, DataProtectionConsentService],
})
export class LegalModule {}
