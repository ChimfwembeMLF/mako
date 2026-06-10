import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataDeletionRequests } from './entities/data_deletion_requests.entity';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { DataDeletionService } from './data-deletion.service';
import { LegalController } from './legal.controller';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DataDeletionRequests, SocialAccounts]),
    AuthModule,
    UserModule,
    WhatsappModule,
  ],
  providers: [DataDeletionService],
  controllers: [LegalController],
  exports: [DataDeletionService],
})
export class LegalModule {}
