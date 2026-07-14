import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';

import { GmailService } from '../../auth/gmail.service';
import { MailService } from '../../mail/mail.service';
import { SendLeadEmailDto } from '../dto/send-lead-email.dto';
import { LeadsService } from '../leads.service';

export type LeadEmailPayload = {
  to: string;
  subject: string;
  body: string;
  html?: string;
  userId?: string;
};

export type LeadEmailResult = {
  success: true;
  via: 'gmail' | 'smtp';
  id?: string | null;
};

@Injectable()
export class LeadEmailService {
  private readonly logger = new Logger(LeadEmailService.name);

  constructor(
    private readonly mail: MailService,
    private readonly gmail: GmailService,
    private readonly leadsService: LeadsService,
  ) {}

  async prepareSend(
    dto: SendLeadEmailDto,
    userId: string,
  ): Promise<LeadEmailPayload> {
    const to = await this.resolveRecipient(dto);
    const subject = dto.subject?.trim() || 'Lead follow-up';
    const html = dto.htmlBody?.trim() || undefined;
    const body =
      dto.body?.trim() ||
      dto.message?.trim() ||
      html ||
      '';

    if (!body) {
      throw new BadRequestException('Email body is required');
    }

    return {
      to,
      subject,
      body: html ? this.htmlToPlainText(html) : body,
      html,
      userId,
    };
  }

  async sendLeadEmail(params: LeadEmailPayload): Promise<LeadEmailResult> {
    if (params.userId) {
      try {
        const result = await this.gmail.sendEmailAsUser(
          params.userId,
          params.to,
          params.subject,
          params.body,
          params.html,
        );
        return { success: true, via: 'gmail', id: result.id };
      } catch (err) {
        this.logger.warn(
          `Gmail send failed for user ${params.userId}, falling back to SMTP: ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
    }

    if (!this.mail.isSmtpConfigured()) {
      throw new BadRequestException(
        'Cannot send email — connect Gmail or configure SMTP on the server',
      );
    }

    await this.mail.sendGenericEmail(
      params.to,
      params.subject,
      params.body,
      params.html,
    );
    return { success: true, via: 'smtp' };
  }

  private async resolveRecipient(dto: SendLeadEmailDto): Promise<string> {
    const direct = dto.to?.trim();
    if (direct) return direct;

    if (dto.leadId) {
      const lead = await this.leadsService.findOne(dto.leadId);
      const email = lead.email?.trim();
      if (!email) {
        throw new BadRequestException('Lead has no email address');
      }
      return email;
    }

    throw new BadRequestException('Recipient email or leadId is required');
  }

  private htmlToPlainText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
