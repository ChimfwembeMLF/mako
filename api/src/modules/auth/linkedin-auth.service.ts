import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { FindOptionsWhere } from 'typeorm';

import { UserEntity } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { SocialAuthRegisterDto } from './dtos/social-auth.dto';

type LinkedInUserData = {
  sub?: string;
  email?: string | null;
  given_name?: string | null;
  family_name?: string | null;
  picture?: string | null;
};

@Injectable()
export class LinkedInAuthService {
  private readonly logger = new Logger(LinkedInAuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly config: ConfigService,
  ) {}

  getAuthorizationUrl(state?: string): string {
    const params: Record<string, string> = {
      response_type: 'code',
      client_id: this.config.getOrThrow<string>('LINKEDIN_CLIENT_ID'),
      redirect_uri: this.config.getOrThrow<string>('LINKEDIN_CALLBACK_URL'),
      scope: 'openid profile email',
    };

    if (state) {
      params.state = state;
    }

    return `https://www.linkedin.com/oauth/v2/authorization?${new URLSearchParams(
      params,
    ).toString()}`;
  }

  async exchangeCode(code: string): Promise<string> {
    const result = await this.exchangeCodeForTokens(code);
    return result.accessToken;
  }

  async exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.getOrThrow<string>('LINKEDIN_CALLBACK_URL'),
      client_id: this.config.getOrThrow<string>('LINKEDIN_CLIENT_ID'),
      client_secret: this.config.getOrThrow<string>('LINKEDIN_CLIENT_SECRET'),
    });

    const { data } = await axios.post<{
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    }>('https://www.linkedin.com/oauth/v2/accessToken', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!data.access_token) {
      throw new BadRequestException('LinkedIn token exchange failed');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    };
  }

  async authenticate(token: string): Promise<UserEntity> {
    try {
      const userData = await this.getUserData(token);

      const email = userData.email ?? null;
      if (!email) {
        throw new BadRequestException('Invalid token – email missing');
      }

      const where: FindOptionsWhere<UserEntity> = { email };
      const user = await this.userService.findOne(where);
      if (user) return user;

      const newUser: SocialAuthRegisterDto = {
        provider: 'linkedin',
        providerId: userData.sub ?? undefined,
        firstName: userData.given_name ?? undefined,
        lastName: userData.family_name ?? undefined,
        email,
        isRegisteredWithLinkedIn: true,
        avatar: userData.picture ?? undefined,
      };

      return await this.userService.createSociallAuthUser(newUser);
    } catch (err) {
      this.logger.error(err);
      throw new BadRequestException('Invalid LinkedIn token');
    }
  }

  async getUserData(token: string): Promise<LinkedInUserData> {
    const { data } = await axios.get<LinkedInUserData>(
      'https://api.linkedin.com/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    return data;
  }
}
