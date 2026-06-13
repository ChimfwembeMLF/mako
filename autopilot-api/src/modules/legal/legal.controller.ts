import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DataDeletionService } from './data-deletion.service';
import { DataProtectionConsentService } from './data-protection-consent.service';
import { resolveLegalUrls } from './legal-urls.util';
import { WhatsappInboundService } from '../whatsapp/whatsapp-inbound.service';
import { SocialMessagingInboundService } from '../social_inbox/social-messaging-inbound.service';
import { QueueDispatchService } from '../queues/queue-dispatch.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

class DataDeletionRequestDto {
  @IsEmail()
  email: string;
}

class DataProtectionConsentDto {
  @IsString()
  @IsNotEmpty()
  visitorId: string;

  @IsOptional()
  @IsString()
  consentVersion?: string;
}

@ApiTags('Legal')
@Controller()
export class LegalController {
  constructor(
    private readonly deletion: DataDeletionService,
    private readonly consent: DataProtectionConsentService,
    private readonly config: ConfigService,
    private readonly whatsappInbound: WhatsappInboundService,
    private readonly socialMessagingInbound: SocialMessagingInboundService,
    private readonly queueDispatch: QueueDispatchService,
  ) {}

  @Get(['privacy', 'privacy.html'])
  privacy(@Res() res: Response) {
    this.sendPublicHtml(res, 'privacy.html');
  }

  @Get(['terms', 'terms.html'])
  terms(@Res() res: Response) {
    this.sendPublicHtml(res, 'terms.html');
  }

  @Get(['data-deletion', 'data-deletion.html'])
  dataDeletionInfo(@Res() res: Response) {
    this.sendPublicHtml(res, 'data-deletion.html');
  }

  @Get('api/v1/legal/urls')
  legalUrls() {
    const urls = resolveLegalUrls(this.config);
    const appName = this.config.get<string>('APP_NAME') ?? 'Tekrem Innovation Solutions - Mako';
    const supportEmail =
      this.config.get<string>('SUPPORT_EMAIL')?.trim() ?? 'support@agriwide.co';
    return { appName, supportEmail, ...urls };
  }

  @Get('api/v1/legal/deletion-status')
  deletionStatus(@Query('code') code: string) {
    return this.deletion.getStatus(code);
  }

  @Post('api/v1/legal/data-deletion-request')
  @UseGuards(OptionalJwtAuthGuard)
  requestDeletion(@Body() dto: DataDeletionRequestDto, @Req() req: Request) {
    const userId = req.user?.['sub'] as string | undefined;
    return this.deletion.requestByEmail(dto.email, {
      userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('api/v1/legal/data-protection/consent')
  @UseGuards(OptionalJwtAuthGuard)
  recordConsent(@Body() dto: DataProtectionConsentDto, @Req() req: Request) {
    const userId = req.user?.['sub'] as string | undefined;
    return this.consent.recordConsent({
      visitorId: dto.visitorId,
      userId,
      consentVersion: dto.consentVersion,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('api/v1/legal/data-protection/consent')
  async consentStatus(@Query('visitorId') visitorId: string, @Query('version') version?: string) {
    if (!visitorId?.trim()) return { accepted: false };
    const row = await this.consent.hasConsent(visitorId.trim(), version);
    return row ?? { accepted: false };
  }

  /** Meta Platform Data Deletion Callback URL (App Dashboard → Settings → Basic) */
  @Post('api/v1/webhooks/meta/data-deletion')
  metaDataDeletion(@Body() body: { signed_request?: string }) {
    if (!body?.signed_request) return { error: 'signed_request required' };
    return this.deletion.handleMetaSignedRequest(body.signed_request);
  }

  /** Meta webhook verification */
  @Get('api/v1/webhooks/meta')
  metaVerify(
    @Res() res: Response,
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ) {
    const expected = this.config.get<string>('META_WEBHOOK_VERIFY_TOKEN') ?? '';
    if (mode === 'subscribe' && token && expected && token === expected) {
      return res.status(200).send(challenge ?? '');
    }
    return res.status(403).send('Forbidden');
  }

  /** Meta webhook events (WhatsApp inbound messages, etc.) */
  @Post('api/v1/webhooks/meta')
  async metaEvents(@Body() body: unknown) {
    if (this.queueDispatch.isEnabled()) {
      await this.queueDispatch.enqueueWhatsappInbound({ body });
      return { received: true };
    }
    const object = (body as { object?: string })?.object;
    if (object === 'page' || object === 'instagram') {
      return this.socialMessagingInbound.handleMetaWebhook(body);
    }
    return this.whatsappInbound.handleMetaWebhook(body);
  }

  @Post('api/v1/webhooks/meta/deauthorize')
  metaDeauthorize(@Body() body: { signed_request?: string }) {
    if (body?.signed_request) {
      return this.deletion.handleMetaSignedRequest(body.signed_request);
    }
    return { received: true };
  }

  private sendPublicHtml(res: Response, filename: string) {
    try {
      const html = readFileSync(join(process.cwd(), 'public', filename), 'utf8');
      const appName = this.config.get<string>('APP_NAME') ?? 'Tekrem Innovation Solutions - Mako';
      const frontend = (this.config.get<string>('FRONTEND_URL') ?? '').replace(/\/$/, '');
      const supportEmail =
        this.config.get<string>('SUPPORT_EMAIL')?.trim() ?? 'support@agriwide.co';
      const { privacyPolicyUrl, termsOfServiceUrl } = resolveLegalUrls(this.config);
      res
        .type('html')
        .send(
          html
            .replace(/\{\{APP_NAME\}\}/g, appName)
            .replace(/\{\{FRONTEND_URL\}\}/g, frontend)
            .replace(/\{\{SUPPORT_EMAIL\}\}/g, supportEmail)
            .replace(/\{\{PRIVACY_URL\}\}/g, privacyPolicyUrl)
            .replace(/\{\{TERMS_URL\}\}/g, termsOfServiceUrl),
        );
    } catch {
      res.status(404).send('Page not found');
    }
  }
}
