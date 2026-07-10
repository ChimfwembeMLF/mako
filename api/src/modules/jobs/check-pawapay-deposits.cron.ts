import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class CheckPawapayDepositsCron {
  private readonly logger = new Logger(CheckPawapayDepositsCron.name);

  constructor(private readonly payments: PaymentsService) {}

  @Cron('*/2 * * * *')
  async handleCron() {
    this.logger.debug('Running check pending PawaPay deposits job...');
    try {
      const result = await this.payments.checkPendingDeposits();
      if (result.completed > 0) {
        this.logger.log(`Completed ${result.completed} pending deposits.`);
      }
    } catch (err) {
      this.logger.error('Error running pending PawaPay deposits job', err);
    }
  }
}
