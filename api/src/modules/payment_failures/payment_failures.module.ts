import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentFailures } from './entities/payment_failures.entity';
import { PaymentFailuresService } from './payment_failures.service';
import { PaymentFailuresController } from './payment_failures.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentFailures])],
  providers: [PaymentFailuresService],
  controllers: [PaymentFailuresController],
  exports: [PaymentFailuresService],
})
export class PaymentFailuresModule {}
