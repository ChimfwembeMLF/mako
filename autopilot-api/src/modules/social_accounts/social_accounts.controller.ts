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
import { resolveFrontendUrl } from '../../common/env-urls.util';
import { SocialAccountsService } from './social_accounts.service';
import {
  SocialAccountsOAuthService,
  SocialOAuthPlatform,
  OAuthConnectState,
} from './social_accounts-oauth.service';
import { SocialAccountsCreateDto } from './dto/create-social_accounts.dto';
import { WhatsappFinalizeDto } from './dto/whatsapp-finalize.dto';
import { FacebookFinalizeDto } from './dto/facebook-finalize.dto';
import { YoutubeFinalizeDto } from './dto/youtube-finalize.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const OAUTH_PLATFORMS: SocialOAuthPlatform[] = [
  'facebook',
  'linkedin',
  'instagram',
  'google',
  'youtube',
  'whatsapp',
  'tiktok',
];

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
      this.config.get<string>('API_PUBLIC_URL') ||
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
  findByTenant(
    @Req() req: Request,
    @Param('tenantId') tenantId: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    return this.service.findByTenant(tenantId, this.getUserId(req), workspaceId);
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
    @Query('workspaceId') workspaceId?: string,
  ) {
    if (!OAUTH_PLATFORMS.includes(platform as SocialOAuthPlatform)) {
      throw new BadRequestException(`Unsupported OAuth platform: ${platform}`);
    }
    if (!tenantId) {
      throw new BadRequestException('tenantId query parameter is required');
    }

    const userId = this.getUserId(req);
    const apiBase = this.getApiBaseUrl(req);
    const oauthPlatform = platform as SocialOAuthPlatform;
    const redirectUri = this.oauth.getCallbackUrl(apiBase, oauthPlatform);
    let connectState: OAuthConnectState = {
      userId,
      tenantId,
      workspaceId,
      returnUrl,
      provider: oauthPlatform,
      redirectUri,
    };
    if (oauthPlatform === 'tiktok') {
      connectState = this.oauth.attachTikTokPkce(connectState);
    }
    const state = this.oauth.encodeState(connectState);

    const redirectUrl = this.oauth.getAuthorizeUrl(
      oauthPlatform,
      state,
      redirectUri,
      connectState.codeVerifier,
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
    const frontendUrl = resolveFrontendUrl(this.config);
    const fallbackReturn = `${frontendUrl}/publisher`;

    if (error) {
      let message = errorDescription || error;
      if (error === 'unauthorized_scope_error' && platform === 'linkedin') {
        message =
          'LinkedIn rejected a requested permission. Reconnect after removing restricted scopes, or enable Share on LinkedIn (w_member_social) in your LinkedIn app Products tab.';
      }
      return res.redirect(`${fallbackReturn}?error=${encodeURIComponent(message)}`);
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
      if (platform === 'whatsapp') {
        const prepared = await this.oauth.prepareWhatsAppConnect(code, decoded.redirectUri);
        const setupToken = this.oauth.createWhatsAppSetupToken({
          userId: decoded.userId,
          tenantId: decoded.tenantId,
          workspaceId: decoded.workspaceId,
          accessToken: prepared.accessToken,
          expiresAt: prepared.expiresAt?.toISOString(),
          phones: prepared.phones,
        });
        return res.redirect(`${returnUrl}${separator}whatsapp_setup=${encodeURIComponent(setupToken)}`);
      }

      if (platform === 'facebook') {
        const prepared = await this.oauth.prepareFacebookConnect(code, decoded.redirectUri);
        const setupToken = this.oauth.createFacebookSetupToken({
          userId: decoded.userId,
          tenantId: decoded.tenantId,
          workspaceId: decoded.workspaceId,
          accessToken: prepared.accessToken,
          expiresAt: prepared.expiresAt?.toISOString(),
          profile: prepared.profile,
          pages: prepared.pages,
        });
        return res.redirect(`${returnUrl}${separator}facebook_setup=${encodeURIComponent(setupToken)}`);
      }

      if (platform === 'youtube') {
        const prepared = await this.oauth.prepareYoutubeConnect(code, decoded.redirectUri);
        const setupToken = this.oauth.createYoutubeSetupToken({
          userId: decoded.userId,
          tenantId: decoded.tenantId,
          workspaceId: decoded.workspaceId,
          accessToken: prepared.accessToken,
          refreshToken: prepared.refreshToken,
          expiresAt: prepared.expiresAt?.toISOString(),
          profile: prepared.profile,
          channels: prepared.channels,
        });
        return res.redirect(`${returnUrl}${separator}youtube_setup=${encodeURIComponent(setupToken)}`);
      }

      const result = await this.oauth.handleCallback(
        platform as SocialOAuthPlatform,
        code,
        decoded.redirectUri,
        { codeVerifier: decoded.codeVerifier },
      );

      await this.service.connectAccount({
        tenantId: decoded.tenantId,
        workspaceId: decoded.workspaceId,
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
  @ApiOperation({ summary: 'Preview Facebook Pages from OAuth setup token' })
  @Get('facebook/setup')
  getFacebookSetup(@Query('token') token?: string) {
    if (!token?.trim()) {
      throw new BadRequestException('token query parameter is required');
    }
    return this.oauth.getFacebookSetupPreview(token.trim());
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Finalize Facebook connect after selecting a Page' })
  @Post('facebook/finalize')
  async finalizeFacebook(@Req() req: Request, @Body() dto: FacebookFinalizeDto) {
    const userId = this.getUserId(req);
    const payload = this.oauth.verifyFacebookSetupToken(dto.setupToken);

    if (payload.userId !== userId) {
      throw new UnauthorizedException('Facebook setup token does not belong to this user');
    }

    const result = await this.oauth.buildFacebookConnectResult(payload, dto.pageId);

    return this.service.connectAccount({
      tenantId: payload.tenantId,
      workspaceId: payload.workspaceId,
      userId: payload.userId,
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
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Preview YouTube channels from OAuth setup token' })
  @Get('youtube/setup')
  getYoutubeSetup(@Query('token') token?: string) {
    if (!token?.trim()) {
      throw new BadRequestException('token query parameter is required');
    }
    return this.oauth.getYoutubeSetupPreview(token.trim());
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Finalize YouTube connect after selecting a channel' })
  @Post('youtube/finalize')
  async finalizeYoutube(@Req() req: Request, @Body() dto: YoutubeFinalizeDto) {
    const userId = this.getUserId(req);
    const payload = this.oauth.verifyYoutubeSetupToken(dto.setupToken);

    if (payload.userId !== userId) {
      throw new UnauthorizedException('YouTube setup token does not belong to this user');
    }

    const result = this.oauth.buildYoutubeConnectResult(payload, dto.channelId);

    return this.service.connectAccount({
      tenantId: payload.tenantId,
      workspaceId: payload.workspaceId,
      userId: payload.userId,
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
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable platform-managed WhatsApp for a workspace (no client Meta setup)' })
  @Post('whatsapp/enable-platform')
  enablePlatformWhatsapp(@Req() req: Request, @Query('tenantId') tenantId?: string) {
    if (!tenantId) {
      throw new BadRequestException('tenantId query parameter is required');
    }
    return this.service.enablePlatformWhatsapp(tenantId, this.getUserId(req));
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Try WhatsApp setup using an existing Facebook connection (skips Meta login when scopes allow)',
  })
  @Post('whatsapp/setup-from-meta')
  setupWhatsappFromMeta(@Req() req: Request, @Query('tenantId') tenantId?: string) {
    if (!tenantId) {
      throw new BadRequestException('tenantId query parameter is required');
    }
    return this.service.prepareWhatsappFromExistingMeta(tenantId, this.getUserId(req));
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Preview WhatsApp phone numbers from OAuth setup token' })
  @Get('whatsapp/setup')
  getWhatsAppSetup(@Query('token') token?: string) {
    if (!token?.trim()) {
      throw new BadRequestException('token query parameter is required');
    }
    return this.oauth.getWhatsAppSetupPreview(token.trim());
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Finalize WhatsApp connect after selecting a phone number' })
  @Post('whatsapp/finalize')
  async finalizeWhatsApp(@Req() req: Request, @Body() dto: WhatsappFinalizeDto) {
    const userId = this.getUserId(req);
    const payload = this.oauth.verifyWhatsAppSetupToken(dto.setupToken);

    if (payload.userId !== userId) {
      throw new UnauthorizedException('WhatsApp setup token does not belong to this user');
    }

    const phone = payload.phones.find((p) => p.id === dto.phoneNumberId);
    if (!phone) {
      throw new BadRequestException('Selected phone number is not available for this setup session');
    }

    const accountName =
      phone.verifiedName ||
      phone.displayPhoneNumber ||
      phone.wabaName ||
      'WhatsApp Business';

    return this.service.connectAccount({
      tenantId: payload.tenantId,
      workspaceId: payload.workspaceId,
      userId: payload.userId,
      platform: 'whatsapp',
      accountName,
      externalId: phone.id,
      username: phone.displayPhoneNumber,
      accessToken: payload.accessToken,
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : undefined,
      metadata: {
        phone_number_id: phone.id,
        display_phone_number: phone.displayPhoneNumber,
        verified_name: phone.verifiedName,
        waba_id: phone.wabaId,
        waba_name: phone.wabaName,
      },
      connected: true,
    });
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
