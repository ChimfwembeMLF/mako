import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Deposits } from '../deposits/entities/deposits.entity';
import { Tenants } from '../tenants/entities/tenants.entity';
import { TenantSubscriptions } from '../subscriptions/entities/tenant_subscriptions.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TenantMembersModule } from '../tenant_members/tenant_members.module';
import { PaymentsService } from './payments.service';
import { SubscriptionRenewalService } from './subscription-renewal.service';
import { PaymentsController } from './payments.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Deposits, Tenants, TenantSubscriptions]),
    SubscriptionsModule,
    TenantMembersModule,
    NotificationsModule,
  ],
  providers: [PaymentsService, SubscriptionRenewalService],
  controllers: [PaymentsController],
  exports: [PaymentsService, SubscriptionRenewalService],
})
export class PaymentsModule {}
