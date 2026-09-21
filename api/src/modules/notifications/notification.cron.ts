import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationCron {
  private readonly logger = new Logger(NotificationCron.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  /** Daily at 9am — subscription ending within 7 days */
  @Cron('0 9 * * *')
  async subscriptionEndingSoon(): Promise<void> {
    if (this.config.get<string>('NOTIFICATION_CRON_ENABLED') === 'false')
      return;
    try {
      const sent = await this.notifications.checkSubscriptionEndingSoon();
      if (sent > 0) {
        this.logger.log(
          `Subscription-ending notifications sent for ${sent} tenant(s)`,
        );
      }
    } catch (err) {
      this.logger.error('Subscription ending cron error', err);
    }
  }

  /** Mondays at 9am — weekly content interaction digest */
  @Cron('0 9 * * 1')
  async weeklyDigest(): Promise<void> {
    if (this.config.get<string>('WEEKLY_DIGEST_CRON_ENABLED') === 'false')
      return;
    try {
      const sent = await this.notifications.sendWeeklyDigests();
      this.logger.log(`Weekly digest sent for ${sent} tenant(s)`);
    } catch (err) {
      this.logger.error('Weekly digest cron error', err);
    }
  }

  /** Hourly — Send approval reminders for scheduled posts waiting in draft */
  @Cron('0 * * * *')
  async approvalReminders(): Promise<void> {
    if (this.config.get<string>('APPROVAL_REMINDER_CRON_ENABLED') === 'false')
      return;
    try {
      const sent = await this.notifications.sendApprovalReminders();
      if (sent > 0) {
        this.logger.log(`Approval reminders sent to ${sent} tenant(s)`);
      }
    } catch (err) {
      this.logger.error('Approval reminders cron error', err);
    }
  }
}
