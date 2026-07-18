import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { createHash, randomBytes } from 'crypto';
import { FindOptionsWhere } from 'typeorm';

import { UserEntity } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { SocialAuthRegisterDto } from './dtos/social-auth.dto';
import { twitterLoginScopesParam } from './twitter-auth.scopes';

type TwitterAuthState = {
  codeVerifier: string;
  clientState?: string;
};

type TwitterUserData = {
  id?: string;
  name?: string;
  username?: string;
  profile_image_url?: string;
};

@Injectable()
export class TwitterAuthService {
  private readonly logger = new Logger(TwitterAuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly config: ConfigService,
  ) {}

  private get clientId(): string {
    return this.config.getOrThrow<string>('TWITTER_CLIENT_ID');
  }

  private get clientSecret(): string {
    return this.config.getOrThrow<string>('TWITTER_CLIENT_SECRET');
  }

  private get callbackUrl(): string {
    return this.config.getOrThrow<string>('TWITTER_CALLBACK_URL');
  }

  private encodeState(state: TwitterAuthState): string {
    return Buffer.from(JSON.stringify(state)).toString('base64url');
  }

  private decodeState(state: string): TwitterAuthState | null {
    try {
      let raw = state.trim();
      for (let i = 0; i < 3 && raw.includes('%'); i++) {
        raw = decodeURIComponent(raw);
      }
      const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
      const pad = b64.length % 4;
      const padded = pad ? b64 + '='.repeat(4 - pad) : b64;
      return JSON.parse(
        Buffer.from(padded, 'base64').toString('utf8'),
      ) as TwitterAuthState;
    } catch {
      return null;
    }
  }

  getAuthorizationUrl(clientState?: string): string {
    const codeVerifier = randomBytes(48).toString('base64url').slice(0, 64);
    const state = this.encodeState({ codeVerifier, clientState });
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      scope: twitterLoginScopesParam(),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    this.logger.log(
      `X login authorize (redirect_uri=${this.callbackUrl})`,
    );

    return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(
    code: string,
    stateParam?: string,
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: Date }> {
    const decoded = stateParam ? this.decodeState(stateParam) : null;
    if (!decoded?.codeVerifier) {
      throw new BadRequestException(
        'Invalid OAuth state — please start sign-in again',
      );
    }

    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      'base64',
    );

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.callbackUrl,
      code_verifier: decoded.codeVerifier,
    });

    const { data } = await axios.post<{
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    }>('https://api.twitter.com/2/oauth2/token', body.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
    });

    if (data.error || !data.access_token) {
      throw new BadRequestException(
        data.error_description || data.error || 'X token exchange failed',
      );
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
    };
  }

  async getUserData(token: string): Promise<TwitterUserData> {
    const { data } = await axios.get<{
      data?: TwitterUserData;
      errors?: Array<{ message?: string }>;
    }>('https://api.twitter.com/2/users/me', {
      params: { 'user.fields': 'profile_image_url,username,name' },
      headers: { Authorization: `Bearer ${token}` },
    });

    if (data.errors?.length || !data.data?.id) {
      throw new BadRequestException(
        data.errors?.[0]?.message || 'Invalid X token — profile unavailable',
      );
    }

    return data.data;
  }

  private syntheticEmail(twitterId: string): string {
    return `x.${twitterId}@x.auth`;
  }

  async authenticate(token: string): Promise<UserEntity> {
    try {
      const userData = await this.getUserData(token);
      const twitterId = userData.id!;

      const existing = await this.userService.findOne({
        provider: 'twitter',
        providerId: twitterId,
      } as FindOptionsWhere<UserEntity>);
      if (existing) return existing;

      const nameParts = (userData.name ?? '').trim().split(/\s+/);
      const newUser: SocialAuthRegisterDto = {
        provider: 'twitter',
        providerId: twitterId,
        firstName: nameParts[0] || userData.username || undefined,
        lastName: nameParts.slice(1).join(' ') || undefined,
        email: this.syntheticEmail(twitterId),
        isRegisteredWithTwitter: true,
        avatar: userData.profile_image_url ?? undefined,
      };

      return await this.userService.createSociallAuthUser(newUser);
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error('X authentication failed', err);
      throw new BadRequestException('X authentication failed');
    }
  }
}
