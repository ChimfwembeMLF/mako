import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  Query,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { TokenVerificationDto } from './dtos/token-verification.dto';
import { GoogleAuthService } from './google-auth.service';
import { FacebookAuthService } from './facebook-auth.service';
import { LinkedInAuthService } from './linkedin-auth.service';
import { InstagramAuthService } from './instagram-auth.service';
import { ConfigService } from '@nestjs/config';
import { resolveFrontendUrl } from '../../common/env-urls.util';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

type SocialOAuthUser = {
  accessToken?: string;
  refreshToken?: string;  // Add this line
  provider?: string;
  providerId?: string;
  email?: string;
  picture?: string;
  user?: {
    email?: string;
    firstName?: string;
    lastName?: string;
  };
};

@Controller('api/v1/auth')
@ApiTags('Auth')
export class AuthController {
  private frontendUrl: string;

  constructor(
    private readonly authService: AuthService,
    private readonly googleAuthService: GoogleAuthService,
    private readonly facebookAuthService: FacebookAuthService,
    private readonly linkedInAuthService: LinkedInAuthService,
    private readonly instagramAuthService: InstagramAuthService,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = resolveFrontendUrl(this.config);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register with email and password' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request a password reset link' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(forgotPasswordDto);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using token' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() refreshDto: RefreshTokenDto) {
    return this.authService.refresh(refreshDto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  async logout(@Req() req: Request) {
    const userId = req.user?.['sub'];
    await this.authService.revokeRefreshToken(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async me(@Req() req: Request) {
    const userId = req.user?.['sub'];
    return this.authService.getUserProfile(userId);
  }

  // ========== SOCIAL LOGIN (SIGN IN) ENDPOINTS ==========

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Start Google OAuth login' })
  googleAuth() {
    // Redirect handled by Passport
  }

  @Get('google/redirect')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    try {
      const profile = req.user as SocialOAuthUser & { refreshToken?: string };
      const user = await this.googleAuthService.authenticate(profile.accessToken!);
      const tokens = await this.authService.completeAuthentication(user);
      return res.redirect(`${this.frontendUrl}/auth/callback?token=${tokens.token}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google authentication failed';
      return res.redirect(
        `${this.frontendUrl}/auth/callback?error=${encodeURIComponent(message)}`,
      );
    }
  }

  @Post('google-auth')
  @ApiOperation({ summary: 'Authenticate with Google access token' })
  async googleAuthenticate(@Body() dto: TokenVerificationDto) {
    const user = await this.googleAuthService.authenticate(dto.token);
    return this.authService.completeAuthentication(user);
  }

  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  @ApiOperation({ summary: 'Start Facebook OAuth login' })
  facebookLogin() {
    // Redirect handled by Passport
  }

  @Get('facebook/redirect')
  @UseGuards(AuthGuard('facebook'))
  @ApiOperation({ summary: 'Facebook OAuth callback' })
  async facebookLoginRedirect(@Req() req: Request, @Res() res: Response) {
    const payload = req.user as SocialOAuthUser;
    const user = await this.facebookAuthService.authenticate(payload.accessToken!);
    const tokens = await this.authService.completeAuthentication(user);
    return res.redirect(`${this.frontendUrl}/auth/callback?token=${tokens.token}`);
  }

  @Post('facebook-auth')
  @ApiOperation({ summary: 'Authenticate with Facebook access token' })
  async facebookAuthenticate(@Body() dto: TokenVerificationDto) {
    const user = await this.facebookAuthService.authenticate(dto.token);
    return this.authService.completeAuthentication(user);
  }

  @Get('linkedin')
  @ApiOperation({ summary: 'Start LinkedIn OAuth login' })
  linkedInLogin(@Res() res: Response, @Query('state') state?: string) {
    return res.redirect(this.linkedInAuthService.getAuthorizationUrl(state));
  }

  @Get('linkedin/redirect')
  @ApiOperation({ summary: 'LinkedIn OAuth callback' })
  async linkedInLoginRedirect(
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
  ) {
    if (error) {
      const message = errorDescription || error;
      return res.redirect(`${this.frontendUrl}/auth/callback?error=${encodeURIComponent(message)}`);
    }
    if (!code) throw new BadRequestException('Missing authorization code');

    const tokenResult = await this.linkedInAuthService.exchangeCodeForTokens(code);

    const user = await this.linkedInAuthService.authenticate(tokenResult.accessToken);
    const tokens = await this.authService.completeAuthentication(user);
    return res.redirect(`${this.frontendUrl}/auth/callback?token=${tokens.token}`);
  }

  @Post('linkedin-auth')
  @ApiOperation({ summary: 'Authenticate with LinkedIn access token' })
  async linkedInAuthenticate(@Body() dto: TokenVerificationDto) {
    const user = await this.linkedInAuthService.authenticate(dto.token);
    return this.authService.completeAuthentication(user);
  }

  @Get('instagram')
  @ApiOperation({ summary: 'Start Instagram OAuth login' })
  instagramLogin(@Res() res: Response, @Query('state') state?: string) {
    return res.redirect(this.instagramAuthService.getAuthorizationUrl(state));
  }

  @Get('instagram/redirect')
  @ApiOperation({ summary: 'Instagram OAuth callback' })
  async instagramLoginRedirect(
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
  ) {
    if (error) {
      const message = errorDescription || error;
      return res.redirect(`${this.frontendUrl}/auth/callback?error=${encodeURIComponent(message)}`);
    }
    if (!code) throw new BadRequestException('Missing authorization code');

    const cleanCode = code.replace(/#_$/, '').trim();

    try {
      const tokenResult = await this.instagramAuthService.exchangeCodeForTokens(cleanCode);
      const user = await this.instagramAuthService.authenticate(
        tokenResult.accessToken,
        tokenResult.instagramUserId,
      );
      const tokens = await this.authService.completeAuthentication(user);
      return res.redirect(`${this.frontendUrl}/auth/callback?token=${tokens.token}`);
    } catch (err) {
      const message =
        err instanceof BadRequestException
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Instagram authentication failed';
      return res.redirect(
        `${this.frontendUrl}/auth/callback?error=${encodeURIComponent(message)}`,
      );
    }
  }

  @Post('instagram-auth')
  @ApiOperation({ summary: 'Authenticate with Instagram access token' })
  async instagramAuthenticate(@Body() dto: TokenVerificationDto) {
    const user = await this.instagramAuthService.authenticate(dto.token);
    return this.authService.completeAuthentication(user);
  }
}