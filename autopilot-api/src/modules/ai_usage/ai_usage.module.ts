import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiUsage } from './entities/ai_usage.entity';
import { AiUsageService } from './ai_usage.service';
import { AiUsageController } from './ai_usage.controller';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([AiUsage]),
    SubscriptionsModule,
  ],
  providers: [AiUsageService],
  controllers: [AiUsageController],
  exports: [AiUsageService],
})
export class AiUsageModule {}
