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

  isSmtpConfigured(): boolean {
    return this.isConfigured();
  }

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
    const subject = 'Reset your Mako password';
    const text = [
      'You requested a password reset for your Mako account.',
      '',
      `Reset your password: ${resetLink}`,
      '',
      'This link expires in 1 hour. If you did not request this, you can ignore this email.',
    ].join('\n');

    if (!this.isConfigured()) {
      this.logger.warn(
        `Mail not configured — password reset link for ${to}: ${resetLink}`,
      );
      return;
    }

    const from = this.config.get<string>('MAIL_FROM');
    await this.mailer.sendMail({
      to,
      from,
      subject,
      text,
      html: `
        <p>You requested a password reset for your Mako account.</p>
        <p><a href="${resetLink}">Reset your password</a></p>
        <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
      `,
    });

    this.logger.log(`Password reset email sent to ${to}`);
  }

  async sendWorkspaceInviteEmail(
    to: string,
    workspaceName: string,
    signupLink: string,
  ): Promise<void> {
    const appName = this.config.get<string>('APP_NAME') ?? 'Mako ';
    const subject = `You've been invited to ${workspaceName} on ${appName}`;
    const text = [
      `You've been invited to join "${workspaceName}" on ${appName}.`,
      '',
      `Create your account or sign in with this email (${to}) to access the workspace:`,
      signupLink,
      '',
      'This invitation expires in 7 days.',
    ].join('\n');

    if (!this.isConfigured()) {
      this.logger.warn(
        `Mail not configured — workspace invite for ${to}: ${signupLink}`,
      );
      return;
    }

    const from = this.config.get<string>('MAIL_FROM');
    await this.mailer.sendMail({
      to,
      from,
      subject,
      text,
      html: `
        <p>You've been invited to join <strong>${workspaceName}</strong> on ${appName}.</p>
        <p>Create your account or sign in with <strong>${to}</strong> to access the workspace:</p>
        <p><a href="${signupLink}">Accept invitation</a></p>
        <p>This invitation expires in 7 days.</p>
      `,
    });

    this.logger.log(`Workspace invite email sent to ${to}`);
  }

  async sendGenericEmail(
    to: string,
    subject: string,
    text: string,
    html?: string,
  ): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(`Mail not configured — would send to ${to}: ${subject}`);
      return;
    }
    const from = this.config.get<string>('MAIL_FROM');
    await this.mailer.sendMail({
      to,
      from,
      subject,
      text,
      html: html ?? `<pre>${text}</pre>`,
    });
    this.logger.log(`Email sent to ${to}: ${subject}`);
  }
}
