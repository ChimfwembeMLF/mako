import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SubscriptionRenewalService } from '../payments/subscription-renewal.service';

@Injectable()
export class SubscriptionRenewalCron {
  private readonly logger = new Logger(SubscriptionRenewalCron.name);

  constructor(
    private readonly renewals: SubscriptionRenewalService,
    private readonly config: ConfigService,
  ) {}

  /** Check for due renewals twice daily (7am and 7pm). */
  @Cron('0 7,19 * * *')
  async processRenewals(): Promise<void> {
    if (this.config.get<string>('SUBSCRIPTION_RENEWAL_CRON_ENABLED') === 'false') return;
    try {
      const result = await this.renewals.processDueRenewals();
      if (result.initiated || result.pastDue || result.expired) {
        this.logger.log(
          `Renewals: ${result.initiated} initiated, ${result.pastDue} past due, ${result.expired} expired`,
        );
      }
    } catch (err) {
      this.logger.error('Subscription renewal cron error', err);
    }
  }
}
