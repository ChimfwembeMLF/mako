import { Injectable } from '@nestjs/common';
import { MailService } from '../../mail/mail.service';

@Injectable()
export class LeadEmailService {
  constructor(private readonly mail: MailService) {}

  async sendLeadEmail(params: { to: string; subject: string; body: string }) {
    return this.mail.sendGenericEmail(params.to, params.subject, params.body);
  }
}
