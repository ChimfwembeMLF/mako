import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Leads } from './entities/leads.entity';
import { LeadSources } from '../lead_sources/entities/lead_sources.entity';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { LeadClassifyService } from './services/lead-classify.service';
import { LeadEmailService } from './services/lead-email.service';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { QueuesModule } from '../queues/queues.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Leads, LeadSources]),
    AiModule,
    MailModule,
    AuthModule,
    SubscriptionsModule,
    forwardRef(() => QueuesModule),
  ],
  providers: [LeadsService, LeadClassifyService, LeadEmailService],
  controllers: [LeadsController],
  exports: [LeadsService, LeadClassifyService, LeadEmailService],
})
export class LeadsModule {}
