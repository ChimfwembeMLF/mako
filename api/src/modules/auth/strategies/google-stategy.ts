import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { createOAuthCookieStateStore } from '../../../common/oauth-cookie-state.store';
import { GMAIL_OAUTH_SCOPES } from '../../mail/gmail-scopes';
import { PlatformIntegrationsService } from '../../system_settings/services/platform-integrations.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly config: ConfigService,
    private readonly integrations: PlatformIntegrationsService,
  ) {
    const options: any = {
      clientID: config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: config.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      scope: [...GMAIL_OAUTH_SCOPES],
      accessType: 'offline',
      prompt: 'consent',
      state: true,
      store: createOAuthCookieStateStore(config.get<string>('SESSION_SECRET')),
    };
    super(options);
  }

  async authenticate(req: any, options?: any) {
    try {
      const clientId = await this.integrations.getIntegrationWithEnvFallback('GOOGLE_CLIENT_ID');
      const clientSecret = await this.integrations.getIntegrationWithEnvFallback('GOOGLE_CLIENT_SECRET');
      if (clientId && clientSecret) {
        const oauth2 = (this as any)._oauth2;
        console.log('GoogleStrategy fallback: replacing client_id with', clientId, !!oauth2);
        if (oauth2) {
          oauth2._clientId = clientId;
          oauth2._clientSecret = clientSecret;
        }
      } else {
        console.log('GoogleStrategy fallback: clientId or clientSecret is empty!', { clientId, clientSecret });
      }
    } catch (e) {
      // Ignore error and fall back to default credentials
    }
    super.authenticate(req, options);
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
