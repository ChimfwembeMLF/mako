import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappTemplate } from './entities/whatsapp_template.entity';
import { WhatsappTemplatesService } from './whatsapp-templates.service';
import { WhatsappTemplatesController } from './whatsapp-templates.controller';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { WhatsappMessagingService } from '../whatsapp/whatsapp-messaging.service';

@Module({
  imports: [TypeOrmModule.forFeature([WhatsappTemplate, SocialAccounts])],
  providers: [WhatsappTemplatesService, WhatsappMessagingService],
  controllers: [WhatsappTemplatesController],
  exports: [WhatsappTemplatesService],
})
export class WhatsappTemplatesModule {}
