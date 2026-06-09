import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { isAxiosError } from 'axios';
import { FindOptionsWhere } from 'typeorm';

import { UserEntity } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { SocialAuthRegisterDto } from './dtos/social-auth.dto';

type InstagramUserData = {
  id?: string;
  user_id?: string;
  username?: string;
};

type InstagramTokenPayload = {
  access_token?: string;
  user_id?: string;
  permissions?: string;
  expires_in?: number;
};

type InstagramTokenResponse = InstagramTokenPayload & {
  data?: InstagramTokenPayload[];
  error_type?: string;
  error_message?: string;
  code?: number;
};

@Injectable()
export class InstagramAuthService {
  private readonly logger = new Logger(InstagramAuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Instagram Login uses the Instagram App ID from:
   * Meta Dashboard → Instagram → API setup with Instagram login → Business login settings
   */
  private get clientId(): string {
    return this.config.getOrThrow<string>('INSTAGRAM_CLIENT_ID');
  }

  private get clientSecret(): string {
    return this.config.getOrThrow<string>('INSTAGRAM_CLIENT_SECRET');
  }

  private get callbackUrl(): string {
    return this.config.getOrThrow<string>('INSTAGRAM_CALLBACK_URL');
  }

  getAuthorizationUrl(state?: string): string {
    const params: Record<string, string> = {
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      scope: 'instagram_business_basic',
      response_type: 'code',
      force_reauth: 'true',
    };

    if (state) {
      params.state = state;
    }

    this.logger.log(`Instagram login authorize (client_id=${this.clientId}, redirect_uri=${this.callbackUrl})`);

    return `https://www.instagram.com/oauth/authorize?${new URLSearchParams(params).toString()}`;
  }

  async exchangeCode(code: string): Promise<string> {
    const result = await this.exchangeCodeForTokens(code);
    return result.accessToken;
  }

  async exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    instagramUserId?: string;
    expiresAt?: Date;
  }> {
    const cleanCode = code.replace(/#_$/, '').trim();

    let shortData: InstagramTokenResponse;
    try {
      const { data } = await axios.post<InstagramTokenResponse>(
        'https://api.instagram.com/oauth/access_token',
        new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'authorization_code',
          redirect_uri: this.callbackUrl,
          code: cleanCode,
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      shortData = data;
    } catch (err) {
      throw new BadRequestException(this.extractInstagramError(err));
    }

    const tokenPayload = this.normalizeTokenPayload(shortData);
    if (!tokenPayload.access_token) {
      this.logger.error('Instagram code exchange failed', shortData);
      throw new BadRequestException(
        shortData.error_message || 'Instagram token exchange failed',
      );
    }

    try {
      const { data: longData } = await axios.get<InstagramTokenResponse>(
        'https://graph.instagram.com/access_token',
        {
          params: {
            grant_type: 'ig_exchange_token',
            client_secret: this.clientSecret,
            access_token: tokenPayload.access_token,
          },
        },
      );

      if (longData.access_token) {
        return {
          accessToken: longData.access_token,
          instagramUserId: tokenPayload.user_id,
          expiresAt: longData.expires_in
            ? new Date(Date.now() + longData.expires_in * 1000)
            : undefined,
        };
      }
    } catch (err) {
      this.logger.warn('Could not exchange for long-lived Instagram token, using short-lived', err);
    }

    return {
      accessToken: tokenPayload.access_token,
      instagramUserId: tokenPayload.user_id,
      expiresAt: tokenPayload.expires_in
        ? new Date(Date.now() + tokenPayload.expires_in * 1000)
        : undefined,
    };
  }

  /** Meta returns `{ data: [{ access_token, user_id }] }` or a flat object */
  private normalizeTokenPayload(response: InstagramTokenResponse): InstagramTokenPayload {
    if (Array.isArray(response.data) && response.data.length > 0) {
      return response.data[0];
    }
    return response;
  }

  private extractInstagramError(err: unknown): string {
    if (isAxiosError(err)) {
      const body = err.response?.data as InstagramTokenResponse | undefined;
      if (body?.error_message) return body.error_message;
      if (typeof body === 'object' && body && 'message' in body) {
        return String((body as { message?: string }).message);
      }
      return err.message;
    }
    return err instanceof Error ? err.message : 'Instagram token exchange failed';
  }

  async getUserData(token: string, fallbackUserId?: string): Promise<InstagramUserData> {
    try {
      const { data } = await axios.get<
        InstagramUserData & { error?: { message: string } }
      >('https://graph.instagram.com/v21.0/me', {
        params: {
          fields: 'user_id,username',
          access_token: token,
        },
      });

      if (data.error) {
        throw new BadRequestException(`Instagram profile error: ${data.error.message}`);
      }

      const id = data.user_id || data.id || fallbackUserId;
      if (!id) {
        throw new BadRequestException('Invalid Instagram token — no user id');
      }

      return { id, username: data.username };
    } catch (err) {
      if (fallbackUserId) {
        this.logger.warn('Instagram /me failed, using user_id from token exchange', err);
        return { id: fallbackUserId };
      }
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(this.extractInstagramError(err));
    }
  }

  private syntheticEmail(instagramId: string): string {
    return `instagram.${instagramId}@instagram.auth`;
  }

  async authenticate(
    token: string,
    fallbackUserId?: string,
  ): Promise<UserEntity> {
    try {
      const userData = await this.getUserData(token, fallbackUserId);
      const instagramId = userData.id!;

      this.logger.log('Instagram user fetched', {
        instagramId,
        username: userData.username,
      });

      const where: FindOptionsWhere<UserEntity> = {
        provider: 'instagram',
        providerId: instagramId,
      };

      const existingUser = await this.userService.findOne(where);
      if (existingUser) {
        return existingUser;
      }

      const email = this.syntheticEmail(instagramId);

      const newUser: SocialAuthRegisterDto = {
        provider: 'instagram',
        providerId: instagramId,
        firstName: userData.username ?? undefined,
        email,
        isRegisteredWithInstagram: true,
      };

      return await this.userService.createSociallAuthUser(newUser);
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error('Instagram authentication failed', {
        error: err instanceof Error ? err.message : err,
      });
      throw new BadRequestException('Instagram authentication failed');
    }
  }
}
