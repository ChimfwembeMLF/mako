import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Leads } from './entities/leads.entity';
import { Tenants } from '../tenants/entities/tenants.entity';
import { LeadCaptureService } from './lead-capture.service';
import { LeadClassifyService } from './services/lead-classify.service';
import { AiModule } from '../ai/ai.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

/**
 * Small on purpose: the inbox, comments and mail modules import it, so it must not
 * pull in the rest of the leads module (which imports mail).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Leads, Tenants]), AiModule, SubscriptionsModule],
  providers: [LeadCaptureService, LeadClassifyService],
  exports: [LeadCaptureService],
})
export class LeadCaptureModule {}
