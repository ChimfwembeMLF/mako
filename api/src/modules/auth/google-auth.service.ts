import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, Auth } from 'googleapis';

import { UserEntity } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { SocialAuthRegisterDto } from './dtos/social-auth.dto';

type GoogleUserData = {
  email?: string | null;
  given_name?: string | null;
  family_name?: string | null;
  picture?: string | null;
};

export type GoogleOAuthTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
};

@Injectable()
export class GoogleAuthService {
  private readonly oauthClient: Auth.OAuth2Client;
  private readonly logger = new Logger(GoogleAuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly config: ConfigService,
  ) {
    const clientId = this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET');

    this.oauthClient = new google.auth.OAuth2(clientId, clientSecret);
  }

  login(req: { user?: unknown }) {
    if (!req.user) return 'No user from google';

    return {
      message: 'User information from google',
      user: req.user,
    };
  }

  async authenticate(
    token: string,
    oauthTokens?: GoogleOAuthTokens,
  ): Promise<UserEntity> {
    try {
      const userData = await this.getUserData(token);

      const email = userData.email ?? undefined;
      if (!email) {
        throw new BadRequestException('Invalid token');
      }

      let user = await this.userService.findOne({ email });
      if (!user) {
        const newUser: SocialAuthRegisterDto = {
          provider: 'google',
          providerId: userData?.email ?? undefined,
          firstName: userData.given_name ?? undefined,
          lastName: userData.family_name ?? undefined,
          email,
          isRegisteredWithGoogle: true,
          avatar: userData.picture ?? undefined,
        };

        user = await this.userService.createSociallAuthUser(newUser);
      }

      const tokens: GoogleOAuthTokens = oauthTokens ?? { accessToken: token };
      await this.userService.updateGoogleOAuthTokens(user.id, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt:
          tokens.expiresAt ??
          new Date(Date.now() + 55 * 60 * 1000),
      });

      return user;
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : 'Google auth failed',
      );
      throw new BadRequestException('Invalid token');
    }
  }

  async getUserData(token: string): Promise<GoogleUserData> {
    const oauth2 = google.oauth2('v2');

    this.oauthClient.setCredentials({ access_token: token });

    const { data } = await oauth2.userinfo.get({
      auth: this.oauthClient,
    });

    return data;
  }

  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresAt?: Date;
    refreshToken?: string;
  }> {
    this.oauthClient.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await this.oauthClient.refreshAccessToken();
    if (!credentials.access_token) {
      throw new BadRequestException('Failed to refresh Google access token');
    }
    return {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token ?? undefined,
      expiresAt: credentials.expiry_date
        ? new Date(credentials.expiry_date)
        : undefined,
    };
  }
}
