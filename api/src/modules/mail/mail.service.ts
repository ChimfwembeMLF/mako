import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { mailFromAddress } from './mail-transport.util';
import { renderEmail, RenderedEmail } from './templates/email-layout';
import {
  notificationEmail,
  passwordResetEmail,
  plainEmail,
  SystemEmail,
  workspaceInviteEmail,
} from './templates/system-emails';
import { resolveFrontendUrl } from '../../common/env-urls.util';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {}

  private get appName(): string {
    return (this.config.get<string>('APP_NAME') ?? 'Mako').trim() || 'Mako';
  }

  /** Puts a catalogue email into the branded layout. */
  render(email: SystemEmail): RenderedEmail & { subject: string } {
    const appUrl =
      resolveFrontendUrl(this.config) || 'https://mako.tekreminnovations.com';
    const logoUrl =
      this.config.get<string>('EMAIL_LOGO_URL')?.trim() ||
      `${appUrl}/mako-logo.png`;
    return {
      subject: email.subject,
      ...renderEmail(email.content, { logoUrl, appUrl, appName: this.appName }),
    };
  }

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
    if (!this.isConfigured()) {
      // The link is a live credential, so it only appears in local development logs.
      this.logger.warn(
        process.env.NODE_ENV === 'production'
          ? 'Mail not configured — password reset email not sent'
          : `Mail not configured — password reset link for ${to}: ${resetLink}`,
      );
      return;
    }

    const { subject, text, html } = this.render(
      passwordResetEmail({ resetLink, appName: this.appName }),
    );
    await this.mailer.sendMail({
      to,
      from: mailFromAddress(this.config),
      subject,
      text,
      html,
    });
    this.logger.log(`Password reset email sent to ${to}`);
  }

  /** Subject and body of a workspace invitation, shared by the Gmail and SMTP senders. */
  workspaceInviteContent(params: {
    to: string;
    workspaceName: string;
    acceptLink: string;
    hasAccount?: boolean;
    inviterName?: string | null;
  }): { subject: string; text: string; html: string } {
    return this.render(
      workspaceInviteEmail({ ...params, appName: this.appName }),
    );
  }

  /** Sends a workspace invitation over SMTP. Returns false when SMTP is not set up or the send fails. */
  async sendWorkspaceInviteEmail(
    to: string,
    workspaceName: string,
    acceptLink: string,
    hasAccount = false,
    inviterName?: string | null,
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.warn(
        process.env.NODE_ENV === 'production'
          ? `Mail not configured — workspace invite email to ${to} not sent`
          : `Mail not configured — workspace invite for ${to}: ${acceptLink}`,
      );
      return false;
    }

    const { subject, text, html } = this.workspaceInviteContent({
      to,
      workspaceName,
      acceptLink,
      hasAccount,
      inviterName,
    });
    try {
      await this.mailer.sendMail({ to, from: mailFromAddress(this.config), subject, text, html });
    } catch (err) {
      this.logger.error(
        `Workspace invite email to ${to} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }

    this.logger.log(`Workspace invite email sent to ${to}`);
    return true;
  }

  /** A notification (approval reminders, account alerts, …) in the branded layout. */
  notificationContent(params: {
    title: string;
    body: string;
    link?: string | null;
  }) {
    const appUrl =
      resolveFrontendUrl(this.config) || 'https://mako.tekreminnovations.com';
    return this.render(
      notificationEmail({ ...params, appUrl, appName: this.appName }),
    );
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
    // Without HTML of its own, the message still goes out in the branded layout.
    const rendered = html
      ? null
      : this.render(plainEmail({ subject, text, appName: this.appName }));
    await this.mailer.sendMail({
      to,
      from: mailFromAddress(this.config),
      subject,
      text: rendered?.text ?? text,
      html: html ?? rendered!.html,
    });
    this.logger.log(`Email sent to ${to}: ${subject}`);
  }
}
