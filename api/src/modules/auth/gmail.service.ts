import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';

import { UserService } from '../user/user.service';
import { GoogleAuthService } from './google-auth.service';

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly userService: UserService,
    private readonly googleAuth: GoogleAuthService,
  ) {}

  async sendEmailAsUser(
    userId: string,
    to: string,
    subject: string,
    body: string,
  ): Promise<{ id?: string | null }> {
    const user = await this.userService.findOne({ id: userId });
    if (!user?.email) {
      throw new BadRequestException('User has no email for Gmail send');
    }

    let tokens = await this.userService.getGoogleOAuthTokens(userId);
    if (!tokens?.accessToken) {
      throw new BadRequestException(
        'Google OAuth not connected — sign in with Google (gmail.send scope) first',
      );
    }

    if (
      tokens.expiresAt &&
      tokens.expiresAt.getTime() < Date.now() + 60_000
    ) {
      if (!tokens.refreshToken) {
        throw new BadRequestException(
          'Google access token expired — re-authenticate with Google',
        );
      }
      const refreshed = await this.googleAuth.refreshAccessToken(
        tokens.refreshToken,
      );
      await this.userService.updateGoogleOAuthTokens(userId, {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? tokens.refreshToken,
        expiresAt:
          refreshed.expiresAt ??
          new Date(Date.now() + 55 * 60 * 1000),
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

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const raw = this.createRawEmail(user.email, to, subject, body);

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    this.logger.log(`Gmail sent as ${user.email} → ${to} (id=${response.data.id})`);
    return { id: response.data.id };
  }

  private createRawEmail(
    from: string,
    to: string,
    subject: string,
    body: string,
  ): string {
    const emailLines = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      body,
    ];
    const email = emailLines.join('\r\n');
    return Buffer.from(email).toString('base64url');
  }
}
