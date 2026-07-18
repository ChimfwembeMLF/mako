import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './strategies/google-stategy';
import { FacebookStrategy } from './strategies/facebook-strategy';
import { GoogleAuthService } from './google-auth.service';
import { FacebookAuthService } from './facebook-auth.service';
import { LinkedInAuthService } from './linkedin-auth.service';
import { InstagramAuthService } from './instagram-auth.service';
import { TwitterAuthService } from './twitter-auth.service';
import { UserModule } from '../user/user.module';
import { TenantsModule } from '../tenants/tenants.module';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { RefreshTokenService } from './refresh-token.service';
import { MailModule } from '../mail/mail.module';
import { TenantMembersModule } from '../tenant_members/tenant_members.module';
import { GmailService } from './gmail.service';

@Module({
  imports: [
    UserModule,
    TenantsModule,
    TenantMembersModule,
    forwardRef(() => MailModule),
    TypeOrmModule.forFeature([RefreshTokenEntity]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'default_secret',
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    RefreshTokenService,
    JwtStrategy,
    GoogleStrategy,
    FacebookStrategy,
    GoogleAuthService,
    FacebookAuthService,
    LinkedInAuthService,
    InstagramAuthService,
    TwitterAuthService,
    GmailService,
  ],
  exports: [AuthService, RefreshTokenService, GmailService, GoogleAuthService],
})
export class AuthModule {}
