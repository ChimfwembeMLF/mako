import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappContacts } from './entities/whatsapp_contacts.entity';
import { WhatsappContactsService } from './whatsapp_contacts.service';
import { WhatsappContactsController } from './whatsapp_contacts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WhatsappContacts])],
  providers: [WhatsappContactsService],
  controllers: [WhatsappContactsController],
  exports: [WhatsappContactsService],
})
export class WhatsappContactsModule {}
