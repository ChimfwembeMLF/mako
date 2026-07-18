import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, gmail_v1 } from 'googleapis';

import { GoogleAuthService } from '../auth/google-auth.service';
import { UserService } from '../user/user.service';

export type ParsedGmailMessage = {
  id: string;
  threadId?: string;
  fromEmail: string;
  subject: string;
  body: string;
  messageIdHeader?: string;
  isUnread: boolean;
  listUnsubscribe?: string;
  autoSubmitted?: boolean;
};

@Injectable()
export class GmailClientService {
  private readonly logger = new Logger(GmailClientService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly userService: UserService,
    private readonly googleAuth: GoogleAuthService,
  ) {}

  async getGmailClient(userId: string): Promise<gmail_v1.Gmail> {
    const user = await this.userService.findOne({ id: userId });
    if (!user?.email) {
      throw new BadRequestException('User has no email for Gmail');
    }

    let tokens = await this.userService.getGoogleOAuthTokens(userId);
    if (!tokens?.accessToken) {
      throw new BadRequestException('Gmail is not connected for this user');
    }

    if (tokens.expiresAt && tokens.expiresAt.getTime() < Date.now() + 60_000) {
      if (!tokens.refreshToken) {
        throw new BadRequestException(
          'Gmail access token expired — reconnect Gmail',
        );
      }
      const refreshed = await this.googleAuth.refreshAccessToken(
        tokens.refreshToken,
      );
      await this.userService.updateGoogleOAuthTokens(userId, {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? tokens.refreshToken,
        expiresAt:
          refreshed.expiresAt ?? new Date(Date.now() + 55 * 60 * 1000),
      });
      tokens = {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? tokens.refreshToken,
        expiresAt: refreshed.expiresAt,
      };
    }

    const clientId = this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });

    return google.gmail({ version: 'v1', auth: oauth2Client });
  }

  async getProfileHistoryId(userId: string): Promise<string | null> {
    const gmail = await this.getGmailClient(userId);
    const profile = await gmail.users.getProfile({ userId: 'me' });
    return profile.data.historyId ?? null;
  }

  async listUnreadInboxMessageIds(
    userId: string,
    maxResults = 20,
  ): Promise<string[]> {
    return this.listInboxMessageIds(userId, maxResults, { unreadOnly: true });
  }

  async listInboxMessageIds(
    userId: string,
    maxResults = 50,
    options?: { unreadOnly?: boolean },
  ): Promise<string[]> {
    const gmail = await this.getGmailClient(userId);
    const response = await gmail.users.messages.list({
      userId: 'me',
      labelIds: options?.unreadOnly ? ['INBOX', 'UNREAD'] : ['INBOX'],
      maxResults,
      q: '-from:me',
    });
    return (response.data.messages ?? [])
      .map((m) => m.id)
      .filter((id): id is string => Boolean(id));
  }

  async getMessage(
    userId: string,
    messageId: string,
  ): Promise<ParsedGmailMessage | null> {
    const gmail = await this.getGmailClient(userId);
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });
    const data = response.data;
    if (!data.id) return null;

    const headers = data.payload?.headers ?? [];
    const fromRaw = headerValue(headers, 'From');
    const fromEmail = extractEmailAddress(fromRaw);
    const subject = headerValue(headers, 'Subject') ?? '';
    const messageIdHeader = headerValue(headers, 'Message-ID') ?? undefined;
    const listUnsubscribe =
      headerValue(headers, 'List-Unsubscribe') ??
      headerValue(headers, 'List-Unsubscribe-Post');
    const autoSubmitted =
      headerValue(headers, 'Auto-Submitted')?.toLowerCase().includes('auto') ??
      false;
    const body = extractBodyText(data.payload);
    const isUnread = (data.labelIds ?? []).includes('UNREAD');

    return {
      id: data.id,
      threadId: data.threadId ?? undefined,
      fromEmail,
      subject,
      body,
      messageIdHeader,
      isUnread,
      listUnsubscribe,
      autoSubmitted,
    };
  }

  async sendReply(params: {
    userId: string;
    fromEmail: string;
    toEmail: string;
    subject: string;
    body: string;
    threadId?: string;
    inReplyTo?: string;
  }): Promise<{ id?: string | null }> {
    const gmail = await this.getGmailClient(params.userId);
    const raw = this.createRawReplyEmail(params);
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw,
        threadId: params.threadId,
      },
    });
    return { id: response.data.id };
  }

  async createDraft(params: {
    userId: string;
    fromEmail: string;
    toEmail: string;
    subject: string;
    body: string;
    threadId?: string;
    inReplyTo?: string;
  }): Promise<{ draftId?: string | null; messageId?: string | null }> {
    const gmail = await this.getGmailClient(params.userId);
    const raw = this.createRawReplyEmail(params);
    const response = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw,
          threadId: params.threadId,
        },
      },
    });
    return {
      draftId: response.data.id ?? null,
      messageId: response.data.message?.id ?? null,
    };
  }

  isInsufficientScopeError(error: unknown): boolean {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error && 'message' in error
          ? String((error as { message?: unknown }).message)
          : '';
    return (
      message.includes('insufficient') ||
      message.includes('Insufficient Permission') ||
      message.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')
    );
  }

  private createRawReplyEmail(params: {
    fromEmail: string;
    toEmail: string;
    subject: string;
    body: string;
    inReplyTo?: string;
  }): string {
    const subject = params.subject.trim().toLowerCase().startsWith('re:')
      ? params.subject.trim()
      : `Re: ${params.subject.trim()}`;

    const lines = [
      `From: ${params.fromEmail}`,
      `To: ${params.toEmail}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 7bit',
    ];
    if (params.inReplyTo) {
      lines.push(`In-Reply-To: ${params.inReplyTo}`);
      lines.push(`References: ${params.inReplyTo}`);
    }
    lines.push('', params.body);
    return Buffer.from(lines.join('\r\n')).toString('base64url');
  }
}

function headerValue(
  headers: Array<{ name?: string | null; value?: string | null }>,
  name: string,
): string | undefined {
  const match = headers.find(
    (h) => (h.name ?? '').toLowerCase() === name.toLowerCase(),
  );
  return match?.value?.trim() || undefined;
}

function extractEmailAddress(raw?: string): string {
  if (!raw) return '';
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] ?? raw).trim().toLowerCase();
}

function extractBodyText(
  payload?: gmail_v1.Schema$MessagePart | null,
): string {
  if (!payload) return '';

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  const parts = payload.parts ?? [];
  const plain = parts.find((p) => p.mimeType === 'text/plain');
  if (plain?.body?.data) {
    return decodeBase64Url(plain.body.data);
  }

  const html = parts.find((p) => p.mimeType === 'text/html');
  if (html?.body?.data) {
    return htmlToPlainText(decodeBase64Url(html.body.data));
  }

  for (const part of parts) {
    const nested = extractBodyText(part);
    if (nested.trim()) return nested;
  }

  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  return '';
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

function htmlToPlainText(html: string): string {
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
