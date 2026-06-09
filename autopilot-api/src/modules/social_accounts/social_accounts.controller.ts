import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Req,
  Res,
  Query,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
  HttpException,
  Logger,
} from '@nestjs/common';
import axios from 'axios';
import { Request, Response } from 'express';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { SocialAccountsService } from './social_accounts.service';
import { SocialAccountsOAuthService, SocialOAuthPlatform } from './social_accounts-oauth.service';
import { SocialAccountsCreateDto } from './dto/create-social_accounts.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const OAUTH_PLATFORMS: SocialOAuthPlatform[] = ['facebook', 'linkedin', 'instagram', 'google'];

@ApiTags('Social Accounts')
@Controller('api/v1/social-accounts')
export class SocialAccountsController {
  private readonly logger = new Logger(SocialAccountsController.name);

  constructor(
    private readonly service: SocialAccountsService,
    private readonly oauth: SocialAccountsOAuthService,
    private readonly config: ConfigService,
  ) {}

  private getUserId(req: Request): string {
    const userId = req.user?.['sub'] || req.user?.['id'];
    if (!userId) throw new UnauthorizedException('Unable to resolve authenticated user');
    return userId;
  }

  private getApiBaseUrl(req: Request): string {
    return (
      this.config.get<string>('API_BASE_URL') ||
      `${req.protocol}://${req.get('host')}`
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Connect a social account manually (tokens/credentials)' })
  @Post('connect')
  connect(@Req() req: Request, @Body() dto: SocialAccountsCreateDto) {
    const userId = this.getUserId(req);
    if (dto.userId && dto.userId !== userId) {
      throw new UnauthorizedException('Cannot connect social account for another user');
    }
    return this.service.connectAccount({
      ...dto,
      userId,
      connected: true,
    });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List connected social accounts for a tenant' })
  @Get('tenant/:tenantId')
  findByTenant(@Req() req: Request, @Param('tenantId') tenantId: string) {
    return this.service.findByTenant(tenantId, this.getUserId(req));
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get connected social accounts for the current user' })
  @Get('me')
  getMyAccounts(@Req() req: Request) {
    return this.service.findByUser(this.getUserId(req));
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start OAuth flow to connect a platform for a tenant' })
  @Get('oauth/:platform/authorize')
  startOAuth(
    @Req() req: Request,
    @Param('platform') platform: string,
    @Query('tenantId') tenantId: string,
    @Query('returnUrl') returnUrl?: string,
  ) {
    if (!OAUTH_PLATFORMS.includes(platform as SocialOAuthPlatform)) {
      throw new BadRequestException(`Unsupported OAuth platform: ${platform}`);
    }
    if (!tenantId) {
      throw new BadRequestException('tenantId query parameter is required');
    }

    const userId = this.getUserId(req);
    const apiBase = this.getApiBaseUrl(req);
    const redirectUri = this.oauth.getCallbackUrl(apiBase, platform as SocialOAuthPlatform);
    const state = this.oauth.encodeState({
      userId,
      tenantId,
      returnUrl,
      provider: platform as SocialOAuthPlatform,
      redirectUri,
    });

    const redirectUrl = this.oauth.getAuthorizeUrl(
      platform as SocialOAuthPlatform,
      state,
      redirectUri,
    );

    this.logger.log(`OAuth authorize ${platform} → redirect_uri=${redirectUri}`);

    return { redirectUrl, redirectUri };
  }

  @ApiOperation({ summary: 'OAuth callback — connects account and redirects to returnUrl' })
  @Get('oauth/:platform/callback')
  async oauthCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Param('platform') platform: string,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
  ) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const fallbackReturn = `${frontendUrl}/publisher`;

    if (error) {
      const message = encodeURIComponent(errorDescription || error);
      return res.redirect(`${fallbackReturn}?error=${message}`);
    }

    if (!code || !state) {
      throw new BadRequestException('Missing OAuth code or state');
    }

    if (!OAUTH_PLATFORMS.includes(platform as SocialOAuthPlatform)) {
      throw new BadRequestException(`Unsupported OAuth platform: ${platform}`);
    }

    const decoded = this.oauth.decodeState(state);
    if (!decoded || decoded.provider !== platform) {
      const message = encodeURIComponent('Invalid OAuth state — please start connect again from Publisher');
      return res.redirect(`${fallbackReturn}?error=${message}`);
    }

    const returnUrl = decoded.returnUrl || fallbackReturn;
    const separator = returnUrl.includes('?') ? '&' : '?';

    try {
      const result = await this.oauth.handleCallback(
        platform as SocialOAuthPlatform,
        code,
        decoded.redirectUri,
      );

      await this.service.connectAccount({
        tenantId: decoded.tenantId,
        userId: decoded.userId,
        platform: result.platform,
        accountName: result.accountName,
        externalId: result.externalId,
        username: result.username,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt,
        metadata: result.metadata,
        connected: true,
      });

      return res.redirect(`${returnUrl}${separator}connected=${platform}`);
    } catch (err) {
      const message = this.formatOAuthError(err);
      this.logger.error(`OAuth callback failed for ${platform}: ${message}`, err);
      return res.redirect(`${returnUrl}${separator}error=${encodeURIComponent(message)}`);
    }
  }

  private formatOAuthError(err: unknown): string {
    if (err instanceof HttpException) {
      const body = err.getResponse();
      if (typeof body === 'string') return body;
      if (typeof body === 'object' && body && 'message' in body) {
        const msg = (body as { message?: string | string[] }).message;
        return Array.isArray(msg) ? msg.join(', ') : String(msg ?? err.message);
      }
      return err.message;
    }
    if (axios.isAxiosError(err)) {
      const fb = err.response?.data as { error?: { message?: string } } | undefined;
      return fb?.error?.message || err.message;
    }
    return err instanceof Error ? err.message : 'Connection failed';
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect a social account' })
  @Post(':id/disconnect')
  disconnect(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.service.disconnect(id, this.getUserId(req), tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a social account' })
  @Delete(':id')
  remove(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.service.remove(id, this.getUserId(req), tenantId);
  }
}
