import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Deposits } from './entities/deposits.entity';
import { DepositsService } from './deposits.service';
import { DepositsController } from './deposits.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Deposits])],
  providers: [DepositsService],
  controllers: [DepositsController],
  exports: [DepositsService],
})
export class DepositsModule {}
