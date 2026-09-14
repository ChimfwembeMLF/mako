import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleDriveService {
  constructor(private configService: ConfigService) {}

  getOAuthClient(): OAuth2Client {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUrl = this.configService.get<string>('API_BASE_URL') + '/api/v1/integrations/google-drive/callback';

    return new google.auth.OAuth2(clientId, clientSecret, redirectUrl);
  }

  getDriveClient(accessToken: string, refreshToken: string): any {
    const oauth2Client = this.getOAuthClient();
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    
    return google.drive({ version: 'v3', auth: oauth2Client });
  }
}
