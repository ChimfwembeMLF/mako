import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { TenantAccessService } from '../auth/rbac/tenant-access.service';
import { RequirePermission } from '../auth/rbac/require-permission.decorator';
import {
  Patch,
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
import {
  getTwitterConfig,
  resolveTwitterPublisherScopes,
} from '../../common/twitter-config.util';
import { SocialAccountsService } from './social_accounts.service';
import { SocialAccountHealthService } from './social-account-health.service';
import {
  CONNECTOR_PROVIDERS,
  ChannelConnectorsService,
  isConnectorProvider,
} from './channel-connectors.service';
import { TelegramConnectService } from './telegram-connect.service';
import {
  SocialAccountsOAuthService,
  SocialOAuthPlatform,
  OAuthConnectState,
  callbackHost,
} from './social_accounts-oauth.service';
import { SocialAccountsCreateDto } from './dto/create-social_accounts.dto';
import { WhatsappFinalizeDto } from './dto/whatsapp-finalize.dto';
import { FacebookFinalizeDto } from './dto/facebook-finalize.dto';
import { YoutubeFinalizeDto } from './dto/youtube-finalize.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { XWebhookAdminService } from '../social_inbox/x-webhook-admin.service';

const OAUTH_PLATFORMS: SocialOAuthPlatform[] = [
  'facebook',
  'linkedin',
  'instagram',
  'google',
  'youtube',
  'whatsapp',
  'tiktok',
  'twitter',
  ...CONNECTOR_PROVIDERS,
];

class FinalizeChannelSetupDto {
  @IsString()
  setupToken: string;

  @IsString()
  choiceId: string;
}

class TelegramConnectDto {
  @IsUUID()
  tenantId: string;

  @IsOptional()
  @IsUUID()
  workspaceId?: string;

  /** From @BotFather, e.g. 123456:ABC-DEF... */
  @IsString()
  @MaxLength(200)
  botToken: string;

  /** @channelname, a group invite-free username, or a numeric chat id. */
  @IsString()
  @MaxLength(200)
  chat: string;
}

class AccountDefaultsDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  hashtags?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  firstComment?: string | null;
}

@ApiTags('Social Accounts')
@Controller('api/v1/social-accounts')
export class SocialAccountsController {
  private readonly logger = new Logger(SocialAccountsController.name);

  constructor(
    private readonly service: SocialAccountsService,
    private readonly oauth: SocialAccountsOAuthService,
    private readonly config: ConfigService,
    private readonly xWebhook: XWebhookAdminService,
    private readonly access: TenantAccessService,
    private readonly health: SocialAccountHealthService,
    private readonly connectors: ChannelConnectorsService,
    private readonly telegram: TelegramConnectService,
  ) {}

  /** Setup tokens carry the tenant chosen at OAuth start; recheck the role when it is used. */
  private assertCanConnect(userId: string, tenantId: string) {
    return this.access.assertMember(userId, tenantId, 'content.publish');
  }

  private getUserId(req: Request): string {
    const userId = req.user?.['sub'] || req.user?.['id'];
    if (!userId)
      throw new UnauthorizedException('Unable to resolve authenticated user');
    return userId;
  }

  private getApiBaseUrl(req: Request): string {
    return (
      this.config.get<string>('API_PUBLIC_URL') ||
      this.config.get<string>('API_BASE_URL') ||
      `${req.protocol}://${req.get('host')}`
    );
  }

  private async ensureXWebhookAfterConnect(
    req: Request,
    tenantId: string,
    workspaceId: string | undefined,
    platform: string,
  ) {
    if (platform !== 'twitter' && platform !== 'x') return;

    const account = await this.service.findConnectedByPlatform(
      tenantId,
      'twitter',
      workspaceId,
    );
    if (!account) return;

    const result = await this.xWebhook.ensureSubscriptionForAccount(
      account,
      this.getApiBaseUrl(req),
    );
    if (!result.ok) {
      this.logger.warn(
        `X Account Activity subscription skipped: ${
          result.message ?? 'unknown'
        }`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Connect a social account manually (tokens/credentials)',
  })
  @RequirePermission('content.publish')
  @Post('connect')
  async connect(@Req() req: Request, @Body() dto: SocialAccountsCreateDto) {
    const userId = this.getUserId(req);
    if (dto.userId && dto.userId !== userId) {
      throw new UnauthorizedException(
        'Cannot connect social account for another user',
      );
    }
    const result = await this.service.connectAccount({
      ...dto,
      userId,
      connected: true,
    });
    await this.ensureXWebhookAfterConnect(
      req,
      dto.tenantId,
      dto.workspaceId,
      dto.platform,
    );
    return result;
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
    return this.service.findByTenant(
      tenantId,
      this.getUserId(req),
      workspaceId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get connected social accounts for the current user',
  })
  @Get('me')
  getMyAccounts(@Req() req: Request) {
    return this.service.findByUser(this.getUserId(req));
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'X Account Activity webhook URL and subscription info',
  })
  @Get('twitter/webhook-config')
  getTwitterWebhookConfig(@Req() req: Request) {
    const apiBase = this.getApiBaseUrl(req);
    return {
      webhookUrl: this.xWebhook.getWebhookUrl(apiBase),
      webhookEnv: getTwitterConfig(this.config).webhookEnv,
      oauthScopes: resolveTwitterPublisherScopes(this.config),
      dmScopesEnabled: getTwitterConfig(this.config).oauthDmScopes,
      subscriptions: [
        'post.create',
        'post.delete',
        'post.mention.create',
        'dm.sent',
        'dm.read',
        'chat.received',
        'chat.sent',
        'chat.conversation_join',
      ],
      notes:
        'Register the webhook URL in the X Developer Portal (Account Activity API). OAuth 1.0a user tokens (manual connect or TWITTER_OAUTH1_* env) are required to subscribe.',
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Start OAuth flow to connect a platform for a tenant',
  })
  @RequirePermission('content.publish')
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
    if (oauthPlatform === 'tiktok' || oauthPlatform === 'twitter') {
      connectState = this.oauth.attachOAuthPkce(connectState);
    }
    const state = this.oauth.encodeState(connectState);

    const redirectUrl = isConnectorProvider(oauthPlatform)
      ? this.connectors.authorizeUrl(oauthPlatform, state, redirectUri)
      : this.oauth.getAuthorizeUrl(
          oauthPlatform,
          state,
          redirectUri,
          connectState.codeVerifier,
        );

    this.logger.log(
      `OAuth authorize ${platform} → redirect_uri=${redirectUri}`,
    );

    return { redirectUrl, redirectUri };
  }

  @ApiOperation({
    summary: 'OAuth callback — connects account and redirects to returnUrl',
  })
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
      // Providers echo state on errors too — honor its returnUrl so mobile gets the error.
      const errorReturn =
        (state && this.oauth.decodeState(state)?.returnUrl) || fallbackReturn;
      const errorSeparator = errorReturn.includes('?') ? '&' : '?';
      return res.redirect(
        `${errorReturn}${errorSeparator}error=${encodeURIComponent(message)}`,
      );
    }

    if (!code || !state) {
      throw new BadRequestException('Missing OAuth code or state');
    }

    if (!OAUTH_PLATFORMS.includes(platform as SocialOAuthPlatform)) {
      throw new BadRequestException(`Unsupported OAuth platform: ${platform}`);
    }

    const decoded = this.oauth.decodeState(state);
    if (!decoded || callbackHost(decoded.provider) !== platform) {
      const message = encodeURIComponent(
        'Invalid OAuth state — please start connect again from Publisher',
      );
      return res.redirect(`${fallbackReturn}?error=${message}`);
    }

    // A shared callback (e.g. Google's) carries the real provider in the state.
    platform = decoded.provider;
    const returnUrl = decoded.returnUrl || fallbackReturn;
    const separator = returnUrl.includes('?') ? '&' : '?';

    try {
      if (platform === 'whatsapp') {
        const prepared = await this.oauth.prepareWhatsAppConnect(
          code,
          decoded.redirectUri,
        );
        const setupToken = this.oauth.createWhatsAppSetupToken({
          userId: decoded.userId,
          tenantId: decoded.tenantId,
          workspaceId: decoded.workspaceId,
          accessToken: prepared.accessToken,
          expiresAt: prepared.expiresAt?.toISOString(),
          phones: prepared.phones,
        });
        return res.redirect(
          `${returnUrl}${separator}whatsapp_setup=${encodeURIComponent(
            setupToken,
          )}`,
        );
      }

      if (platform === 'facebook') {
        const prepared = await this.oauth.prepareFacebookConnect(
          code,
          decoded.redirectUri,
        );
        const setupToken = this.oauth.createFacebookSetupToken({
          userId: decoded.userId,
          tenantId: decoded.tenantId,
          workspaceId: decoded.workspaceId,
          accessToken: prepared.accessToken,
          expiresAt: prepared.expiresAt?.toISOString(),
          profile: prepared.profile,
          pages: prepared.pages,
        });
        return res.redirect(
          `${returnUrl}${separator}facebook_setup=${encodeURIComponent(
            setupToken,
          )}`,
        );
      }

      if (platform === 'youtube') {
        const prepared = await this.oauth.prepareYoutubeConnect(
          code,
          decoded.redirectUri,
        );
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
        return res.redirect(
          `${returnUrl}${separator}youtube_setup=${encodeURIComponent(
            setupToken,
          )}`,
        );
      }

      if (isConnectorProvider(platform)) {
        const prepared = await this.connectors.prepare(
          platform,
          code,
          decoded.redirectUri,
        );
        if (prepared.kind === 'choose') {
          if (!prepared.choices.length) {
            throw new BadRequestException(
              platform === 'linkedin_page'
                ? 'No company Pages found where you are an admin.'
                : platform === 'pinterest'
                ? 'No boards found. Create a board on Pinterest, then connect again.'
                : 'No business locations found for this Google account.',
            );
          }
          const setupToken = this.connectors.createSetupToken({
            userId: decoded.userId,
            tenantId: decoded.tenantId,
            workspaceId: decoded.workspaceId,
            platform: prepared.platform,
            title: prepared.title,
            accessToken: prepared.accessToken,
            refreshToken: prepared.refreshToken,
            expiresAt: prepared.expiresAt,
            choices: prepared.choices,
          });
          return res.redirect(
            `${returnUrl}${separator}channel_setup=${encodeURIComponent(
              setupToken,
            )}`,
          );
        }
        const one = prepared.result;
        await this.service.connectAccount({
          tenantId: decoded.tenantId,
          workspaceId: decoded.workspaceId,
          userId: decoded.userId,
          platform: one.platform,
          accountName: one.accountName,
          externalId: one.externalId,
          username: one.username,
          accessToken: one.accessToken,
          refreshToken: one.refreshToken,
          expiresAt: one.expiresAt,
          metadata: one.metadata,
          connected: true,
        });
        return res.redirect(
          `${returnUrl}${separator}connected=${one.platform}`,
        );
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

      await this.ensureXWebhookAfterConnect(
        req,
        decoded.tenantId,
        decoded.workspaceId,
        result.platform,
      );

      return res.redirect(`${returnUrl}${separator}connected=${platform}`);
    } catch (err) {
      const message = this.formatOAuthError(err);
      this.logger.error(
        `OAuth callback failed for ${platform}: ${message}`,
        err,
      );
      return res.redirect(
        `${returnUrl}${separator}error=${encodeURIComponent(message)}`,
      );
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
      const data = err.response?.data as
        | { error?: string | { message?: string }; error_description?: string }
        | undefined;
      // OAuth token endpoints (Google, LinkedIn) reply { error, error_description }.
      if (typeof data?.error === 'string') {
        return data.error === 'invalid_grant'
          ? 'That sign-in expired or was already used. Please connect again.'
          : data.error_description || data.error;
      }
      const message = data?.error?.message || err.message;
      // Google: the API is switched off in the Cloud project.
      const disabled = message.match(
        /^(.+? API) has not been used in project \S+ before or it is disabled/,
      );
      if (disabled) {
        return `Turn on the ${disabled[1]} in your Google Cloud project (APIs & Services → Library), wait a few minutes, then connect again.`;
      }
      // Business Profile APIs allow zero calls until Google approves access.
      if (
        /mybusiness\w*\.googleapis\.com/.test(message) ||
        (/quota/i.test(message) && /business/i.test(message))
      ) {
        return 'Google hasn’t approved Business Profile API access for this app yet. Request access in Google Cloud, then connect again.';
      }
      return message;
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
  async finalizeFacebook(
    @Req() req: Request,
    @Body() dto: FacebookFinalizeDto,
  ) {
    const userId = this.getUserId(req);
    const payload = this.oauth.verifyFacebookSetupToken(dto.setupToken);

    if (payload.userId !== userId) {
      throw new UnauthorizedException(
        'Facebook setup token does not belong to this user',
      );
    }
    await this.assertCanConnect(userId, payload.tenantId);

    const result = await this.oauth.buildFacebookConnectResult(
      payload,
      dto.pageId,
    );

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
  @ApiOperation({
    summary: 'Finalize YouTube connect after selecting a channel',
  })
  @Post('youtube/finalize')
  async finalizeYoutube(@Req() req: Request, @Body() dto: YoutubeFinalizeDto) {
    const userId = this.getUserId(req);
    const payload = this.oauth.verifyYoutubeSetupToken(dto.setupToken);

    if (payload.userId !== userId) {
      throw new UnauthorizedException(
        'YouTube setup token does not belong to this user',
      );
    }
    await this.assertCanConnect(userId, payload.tenantId);

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
  @ApiOperation({
    summary:
      'Disabled — platform-managed (shared) WhatsApp is no longer supported. Each client must connect their own WhatsApp Business number via OAuth.',
  })
  @Post('whatsapp/enable-platform')
  enablePlatformWhatsapp() {
    throw new BadRequestException(
      'Shared platform WhatsApp is disabled. Connect your own WhatsApp Business number via Publisher Connect → WhatsApp → Connect.',
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Try WhatsApp setup using an existing Facebook connection (skips Meta login when scopes allow)',
  })
  @RequirePermission('content.publish')
  @Post('whatsapp/setup-from-meta')
  setupWhatsappFromMeta(
    @Req() req: Request,
    @Query('tenantId') tenantId?: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('tenantId query parameter is required');
    }
    return this.service.prepareWhatsappFromExistingMeta(
      tenantId,
      this.getUserId(req),
      workspaceId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Preview WhatsApp phone numbers from OAuth setup token',
  })
  @Get('whatsapp/setup')
  getWhatsAppSetup(@Query('token') token?: string) {
    if (!token?.trim()) {
      throw new BadRequestException('token query parameter is required');
    }
    return this.oauth.getWhatsAppSetupPreview(token.trim());
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Finalize WhatsApp connect after selecting a phone number',
  })
  @Post('whatsapp/finalize')
  async finalizeWhatsApp(
    @Req() req: Request,
    @Body() dto: WhatsappFinalizeDto,
  ) {
    const userId = this.getUserId(req);
    const payload = this.oauth.verifyWhatsAppSetupToken(dto.setupToken);

    if (payload.userId !== userId) {
      throw new UnauthorizedException(
        'WhatsApp setup token does not belong to this user',
      );
    }
    await this.assertCanConnect(userId, payload.tenantId);

    const phone = payload.phones.find((p) => p.id === dto.phoneNumberId);
    if (!phone) {
      throw new BadRequestException(
        'Selected phone number is not available for this setup session',
      );
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
  @ApiOperation({
    summary:
      'What can be picked after signing in (company Pages, boards, locations)',
  })
  @Get('channel-setup')
  channelSetup(@Req() req: Request, @Query('token') token: string) {
    const payload = this.connectors.verifySetupToken(token);
    if (payload.userId !== this.getUserId(req)) {
      throw new BadRequestException('This setup link belongs to someone else.');
    }
    return {
      platform: payload.platform,
      title: payload.title,
      choices: payload.choices.map((c) => ({
        id: c.id,
        name: c.name,
        subtitle: c.subtitle,
      })),
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Connect the Page, board or location picked after signing in',
  })
  @Post('channel-setup/finalize')
  async finalizeChannelSetup(
    @Req() req: Request,
    @Body() dto: FinalizeChannelSetupDto,
  ) {
    const userId = this.getUserId(req);
    const payload = this.connectors.verifySetupToken(dto.setupToken);
    if (payload.userId !== userId) {
      throw new BadRequestException('This setup link belongs to someone else.');
    }
    await this.assertCanConnect(userId, payload.tenantId);
    const choice = payload.choices.find((c) => c.id === dto.choiceId);
    if (!choice)
      throw new BadRequestException('Pick one of the listed options.');
    return this.service.connectAccount({
      tenantId: payload.tenantId,
      workspaceId: payload.workspaceId,
      userId,
      platform: choice.account.platform,
      accountName: choice.account.accountName,
      externalId: choice.account.externalId,
      username: choice.account.username,
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : undefined,
      metadata: choice.account.metadata,
      connected: true,
    });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Connect a Telegram bot to a channel or group' })
  @RequirePermission('content.publish')
  @Post('telegram/connect')
  connectTelegram(@Req() req: Request, @Body() dto: TelegramConnectDto) {
    return this.telegram.connect({ ...dto, userId: this.getUserId(req) });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Accounts with health, activity and who connected them (Social accounts page)',
  })
  @Get('tenant/:tenantId/manage')
  manage(
    @Req() req: Request,
    @Param('tenantId') tenantId: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    return this.service.findForManagement(
      tenantId,
      this.getUserId(req),
      workspaceId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Make this the default account for its platform' })
  @RequirePermission('content.publish')
  @Post(':id/default')
  makeDefault(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ) {
    return this.service.setDefault(id, tenantId, this.getUserId(req));
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Default hashtags and first comment for posts from this account',
  })
  @RequirePermission('content.publish')
  @Patch(':id/defaults')
  saveDefaults(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
    @Body() dto: AccountDefaultsDto,
  ) {
    return this.service.setDefaults(id, tenantId, this.getUserId(req), dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Check the connection still works and has the permissions it needs',
  })
  @RequirePermission('content.publish')
  @Post(':id/check')
  async check(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ) {
    const account = await this.service.findOneForTenant(
      id,
      tenantId,
      this.getUserId(req),
    );
    return this.health.check(account);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect a social account' })
  @RequirePermission('content.publish')
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
  @RequirePermission('content.publish')
  @Delete(':id')
  remove(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.service.remove(id, this.getUserId(req), tenantId);
  }
}
