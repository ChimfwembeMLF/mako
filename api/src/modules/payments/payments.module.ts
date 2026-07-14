import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Deposits } from '../deposits/entities/deposits.entity';
import { Tenants } from '../tenants/entities/tenants.entity';
import { TenantSubscriptions } from '../subscriptions/entities/tenant_subscriptions.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TenantMembersModule } from '../tenant_members/tenant_members.module';
import { PaymentsService } from './payments.service';
import { SubscriptionRenewalService } from './subscription-renewal.service';
import { FxService } from './fx.service';
import { PaymentsController } from './payments.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { RefundRequests } from './entities/refund_requests.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Deposits, Tenants, TenantSubscriptions, RefundRequests]),
    SubscriptionsModule,
    TenantMembersModule,
    NotificationsModule,
  ],
  providers: [PaymentsService, SubscriptionRenewalService, FxService],
  controllers: [PaymentsController],
  exports: [PaymentsService, SubscriptionRenewalService],
})
export class PaymentsModule {}
