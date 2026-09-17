import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { PlatformIntegrationsService } from '../system_settings/services/platform-integrations.service';

@Injectable()
export class GoogleDriveService {
  constructor(
    private configService: ConfigService,
    private integrations: PlatformIntegrationsService,
  ) {}

  async getOAuthClient(): Promise<OAuth2Client> {
    const clientId = await this.integrations.getIntegrationWithEnvFallback('GOOGLE_CLIENT_ID');
    const clientSecret = await this.integrations.getIntegrationWithEnvFallback('GOOGLE_CLIENT_SECRET');
    const redirectUrl = this.configService.get<string>('API_BASE_URL') + '/api/v1/integrations/google-drive/callback';

    return new google.auth.OAuth2(clientId, clientSecret, redirectUrl);
  }

  async getDriveClient(accessToken: string, refreshToken: string): Promise<any> {
    const oauth2Client = await this.getOAuthClient();
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    
    return google.drive({ version: 'v3', auth: oauth2Client });
  }
}
