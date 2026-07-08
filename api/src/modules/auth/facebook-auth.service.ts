// Interface for Facebook request object
export interface FacebookRequest {
  user?: any;
}
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import { UserEntity } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { SocialAuthRegisterDto } from './dtos/social-auth.dto';
import { FindOptionsWhere } from 'typeorm';

type FacebookUserData = {
  id?: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null; // only if you actually expect it
  picture?: { data?: { url?: string | null } };
  name?: string | null;
};

@Injectable()
export class FacebookAuthService {
  private readonly logger = new Logger(FacebookAuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly config: ConfigService,
  ) {}

  login(req: FacebookRequest) {
    if (!req.user) return 'No user from facebook';

    return {
      message: 'User information from facebook',
      user: req.user,
    };
  }

  async authenticate(token: string): Promise<UserEntity> {
    this.logger.log('Facebook authentication started');

    try {
      const userData = await this.getUserData(token);

      const provider = 'facebook';
      const providerId = userData.id;

      if (!providerId) {
        throw new BadRequestException('Invalid Facebook response');
      }

      this.logger.debug('Facebook Graph response', {
        providerId,
        hasEmail: !!userData.email,
      });

      // 1. FIND USER BY PROVIDER ID (PRIMARY IDENTITY RULE)
      let user = await this.userService.findOne({
        provider,
        providerId,
      });

      if (user) {
        this.logger.log('Existing Facebook user found', {
          userId: user.id,
          providerId,
        });

        return user;
      }

      // 2. CREATE USER IF NOT FOUND
      this.logger.log('Creating new Facebook user', {
        providerId,
      });

      const newUser: SocialAuthRegisterDto = {
        provider,
        providerId,

        firstName: userData.first_name ?? undefined,
        lastName: userData.last_name ?? undefined,
        email: userData.email ?? undefined,
        avatar: userData.picture?.data?.url ?? undefined,

        isRegisteredWithFacebook: true,
      };

      user = await this.userService.createSociallAuthUser(newUser);

      this.logger.log('Facebook user created', {
        userId: user.id,
        providerId,
      });

      return user;
    } catch (error) {
      this.logger.error('Facebook authentication failed', {
        error: error instanceof Error ? error.message : error,
      });

      throw new BadRequestException('Facebook authentication failed');
    }
  }

  async getUserData(token: string): Promise<FacebookUserData> {
    const baseUrl =
      this.config.get<string>('FACEBOOK_GRAPH_URL') ??
      'https://graph.facebook.com';

    const url = `${baseUrl}/me?fields=id,first_name,last_name,name,email,picture&access_token=${encodeURIComponent(
      token,
    )}`;

    const { data } = await axios.get<FacebookUserData>(url);

    if (!data) throw new Error('Invalid access token');
    return data;
  }

  async exchangeShortLivedToken(
    accessToken: string,
  ): Promise<{ accessToken: string; expiresAt?: Date }> {
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.config.getOrThrow('FACEBOOK_APP_ID'),
      client_secret: this.config.getOrThrow('FACEBOOK_APP_SECRET'),
      fb_exchange_token: accessToken,
    });

    const { data } = await axios.get<{
      access_token?: string;
      expires_in?: number;
      error?: { message: string };
    }>(
      `https://graph.facebook.com/v19.0/oauth/access_token?${params.toString()}`,
    );

    if (data.error) {
      this.logger.error('Facebook token exchange error', data.error);
      throw new BadRequestException(
        `Facebook token exchange error: ${data.error.message}`,
      );
    }

    if (!data.access_token) {
      throw new BadRequestException('Facebook token exchange failed');
    }

    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    };
  }

  async exchangeCode(code: string): Promise<string> {
    const params = new URLSearchParams({
      client_id: this.config.getOrThrow('FACEBOOK_APP_ID'),
      client_secret: this.config.getOrThrow('FACEBOOK_APP_SECRET'),
      redirect_uri: this.config.getOrThrow('FACEBOOK_CALLBACK_URL'),
      code,
    });

    const { data } = await axios.get<{
      access_token?: string;
      error?: { message: string };
    }>(
      `https://graph.facebook.com/v19.0/oauth/access_token?${params.toString()}`,
    );

    if (data.error) {
      this.logger.error('Facebook code exchange error', data.error);
      throw new BadRequestException(
        `Facebook code exchange error: ${data.error.message}`,
      );
    }

    if (!data.access_token) {
      throw new BadRequestException('Facebook token exchange failed');
    }

    return data.access_token;
  }

  async getPageAccounts(token: string): Promise<any[]> {
    const { data } = await axios.get<{
      data?: any[];
      error?: { message: string };
    }>(`https://graph.facebook.com/v19.0/me/accounts`, {
      params: { access_token: token },
    });

    if (data.error) {
      this.logger.error('Facebook accounts error', data.error);
      throw new BadRequestException(
        `Facebook accounts error: ${data.error.message}`,
      );
    }

    return data.data ?? [];
  }
}
