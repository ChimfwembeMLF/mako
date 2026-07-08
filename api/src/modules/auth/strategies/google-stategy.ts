import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { createOAuthCookieStateStore } from '../../../common/oauth-cookie-state.store';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly config: ConfigService) {
    const options: any = {
      clientID: config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: config.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      scope: ['openid', 'email', 'profile'],
      accessType: 'offline',
      prompt: 'consent',
      state: true,
      store: createOAuthCookieStateStore(config.get<string>('SESSION_SECRET')),
    };
    super(options);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      const email = profile.emails?.[0]?.value;
      const firstName = profile.name?.givenName;
      const lastName = profile.name?.familyName;
      const picture = profile.photos?.[0]?.value;

      if (!email) {
        throw new UnauthorizedException('Google account has no email');
      }

      const user = {
        provider: 'google',
        providerId: profile.id,
        email,
        firstName,
        lastName,
        picture,
        accessToken,
        refreshToken,
      };

      done(null, user);
    } catch (err) {
      done(err as any);
    }
  }
}
