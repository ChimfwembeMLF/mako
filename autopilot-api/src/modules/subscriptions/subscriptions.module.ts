import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemSettingsModule } from '../system_settings/system_settings.module';
import { Deposits } from '../deposits/entities/deposits.entity';
import { TenantSubscriptions } from './entities/tenant_subscriptions.entity';
import { AiUsage } from '../ai_usage/entities/ai_usage.entity';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';
import { PlansSeedService } from './plans-seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TenantSubscriptions, AiUsage, Deposits]),
    SystemSettingsModule,
  ],
  providers: [SubscriptionsService, PlansService, PlansSeedService],
  controllers: [SubscriptionsController, PlansController],
  exports: [SubscriptionsService, PlansService, PlansSeedService],
})
export class SubscriptionsModule {}
