import { Injectable, Logger } from '@nestjs/common';
import { GmailService } from '../../auth/gmail.service';
import { MailService } from '../../mail/mail.service';

@Injectable()
export class LeadEmailService {
  private readonly logger = new Logger(LeadEmailService.name);

  constructor(
    private readonly mail: MailService,
    private readonly gmail: GmailService,
  ) {}

  async sendLeadEmail(params: {
    to: string;
    subject: string;
    body: string;
    userId?: string;
  }) {
    if (params.userId) {
      try {
        return await this.gmail.sendEmailAsUser(
          params.userId,
          params.to,
          params.subject,
          params.body,
        );
      } catch (err) {
        this.logger.warn(
          `Gmail send failed for user ${params.userId}, falling back to SMTP: ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
    }
    await this.mail.sendGenericEmail(params.to, params.subject, params.body);
    return { via: 'smtp' as const };
  }
}
