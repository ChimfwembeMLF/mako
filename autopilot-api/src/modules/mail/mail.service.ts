import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {}

  private isConfigured(): boolean {
    const host = this.config.get<string>('MAIL_HOST');
    const user = this.config.get<string>('MAIL_USERNAME');
    const pass = this.config.get<string>('MAIL_PASSWORD');
    const from = this.config.get<string>('MAIL_FROM');
    const placeholders = ['MAIL_DETAILS', 'MAIL_DETAILS_HERE', 'PASSWORD', ''];
    return Boolean(
      host &&
      user &&
      pass &&
      from &&
      !placeholders.includes(user) &&
      !placeholders.includes(pass) &&
      !placeholders.includes(from),
    );
  }

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    const subject = 'Reset your BrandPilot password';
    const text = [
      'You requested a password reset for your BrandPilot account.',
      '',
      `Reset your password: ${resetLink}`,
      '',
      'This link expires in 1 hour. If you did not request this, you can ignore this email.',
    ].join('\n');

    if (!this.isConfigured()) {
      this.logger.warn(`Mail not configured — password reset link for ${to}: ${resetLink}`);
      return;
    }

    const from = this.config.get<string>('MAIL_FROM');
    await this.mailer.sendMail({
      to,
      from,
      subject,
      text,
      html: `
        <p>You requested a password reset for your BrandPilot account.</p>
        <p><a href="${resetLink}">Reset your password</a></p>
        <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
      `,
    });

    this.logger.log(`Password reset email sent to ${to}`);
  }
}
