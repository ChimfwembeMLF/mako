import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { mailFromAddress } from './mail-transport.util';

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
      // The link is a live credential, so it only appears in local development logs.
      this.logger.warn(
        process.env.NODE_ENV === 'production'
          ? 'Mail not configured — password reset email not sent'
          : `Mail not configured — password reset link for ${to}: ${resetLink}`,
      );
      return;
    }

    const from = mailFromAddress(this.config);
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

  /** Subject and body of a workspace invitation, shared by the Gmail and SMTP senders. */
  workspaceInviteContent(params: {
    to: string;
    workspaceName: string;
    acceptLink: string;
    hasAccount?: boolean;
    inviterName?: string | null;
  }): { subject: string; text: string; html: string } {
    const { to, workspaceName, acceptLink } = params;
    const appName = (this.config.get<string>('APP_NAME') ?? 'Mako').trim();
    const who = params.inviterName?.trim();
    const subject = who
      ? `${who} invited you to ${workspaceName} on ${appName}`
      : `You've been invited to ${workspaceName} on ${appName}`;
    const intro = who
      ? `${who} invited you to join "${workspaceName}" on ${appName}.`
      : `You've been invited to join "${workspaceName}" on ${appName}.`;
    const action = params.hasAccount
      ? `Sign in with ${to} and accept the invitation:`
      : `Create your ${appName} account with ${to}, then accept the invitation:`;
    const footer =
      "This invitation expires in 7 days. If you weren't expecting it, you can ignore this email.";
    const text = [intro, '', action, acceptLink, '', footer].join('\n');

    const esc = (v: string) =>
      v
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    const html = `
        <p>${who ? `${esc(who)} invited you` : "You've been invited"} to join <strong>${esc(workspaceName)}</strong> on ${esc(appName)}.</p>
        <p>${esc(action)}</p>
        <p><a href="${esc(acceptLink)}">Review invitation</a></p>
        <p>${esc(footer)}</p>
      `;
    return { subject, text, html };
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
    const from = mailFromAddress(this.config);
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
