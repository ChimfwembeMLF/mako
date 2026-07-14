import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { GmailInboxSyncService } from '../mail/gmail-inbox-sync.service';

@Injectable()
export class SyncGmailInboxCron {
  private readonly logger = new Logger(SyncGmailInboxCron.name);

  constructor(
    private readonly sync: GmailInboxSyncService,
    private readonly config: ConfigService,
  ) {}

  @Cron('0 */3 * * * *')
  async handleCron() {
    if (this.config.get<string>('GMAIL_INBOX_SYNC_ENABLED') === 'false') {
      return;
    }

    try {
      const result = await this.sync.syncAll();
      if (result.processed > 0 || result.replied > 0) {
        this.logger.log(
          `Gmail inbox sync: processed ${result.processed}, auto-replied ${result.replied}`,
        );
      }
    } catch (error) {
      this.logger.error('Gmail inbox sync job failed', error);
    }
  }
}
