import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-facebook';
import { createOAuthCookieStateStore } from '../../../common/oauth-cookie-state.store';

function resolveFacebookGraphVersion(raw: string | undefined): string {
  const version = raw?.trim() || 'v18.0';
  return version.startsWith('v') ? version : `v${version}`;
}

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(private readonly config: ConfigService) {
    const options = {
      clientID: config.getOrThrow<string>('FACEBOOK_APP_ID'),
      clientSecret: config.getOrThrow<string>('FACEBOOK_APP_SECRET'),
      callbackURL: config.getOrThrow<string>('FACEBOOK_CALLBACK_URL'),
      graphAPIVersion: resolveFacebookGraphVersion(config.get<string>('FACEBOOK_GRAPH_VERSION')),
      profileFields: ['emails', 'name'],
      state: true,
      store: createOAuthCookieStateStore(config.get<string>('SESSION_SECRET')),
    };

    super(options as any);
  }

  private readonly logger = new Logger(FacebookStrategy.name);
  
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: Function,
  ): Promise<void> {
    this.logger.log('Facebook validate started', {
      facebookId: profile.id,
    });
  
    try {
      const payload = {
        provider: 'facebook',
        providerId: profile.id,
  
        email: profile.emails?.[0]?.value ?? null,
        firstName: profile.name?.givenName ?? null,
        lastName: profile.name?.familyName ?? null,
  
        accessToken,
      };
  
      this.logger.log('Facebook validate success', {
        providerId: profile.id,
        hasEmail: !!payload.email,
      });
  
      done(null, payload);
    } catch (err) {
      this.logger.error('Facebook validate failed', {
        facebookId: profile.id,
        error: err,
      });
  
      done(err);
    }
  }
}
