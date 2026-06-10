import { Body, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { IsEmail } from 'class-validator';
import { DataDeletionService } from './data-deletion.service';
import { WhatsappInboundService } from '../whatsapp/whatsapp-inbound.service';

class DataDeletionRequestDto {
  @IsEmail()
  email: string;
}

@ApiTags('Legal')
@Controller()
export class LegalController {
  constructor(
    private readonly deletion: DataDeletionService,
    private readonly config: ConfigService,
    private readonly whatsappInbound: WhatsappInboundService,
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

  @Get('api/v1/legal/deletion-status')
  deletionStatus(@Query('code') code: string) {
    return this.deletion.getStatus(code);
  }

  @Post('api/v1/legal/data-deletion-request')
  requestDeletion(@Body() dto: DataDeletionRequestDto) {
    return this.deletion.requestByEmail(dto.email);
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
      const appName = this.config.get<string>('APP_NAME') ?? 'Tekrem Innvation Solutions Autopilot';
      const frontend = (this.config.get<string>('FRONTEND_URL') ?? '').replace(/\/$/, '');
      res
        .type('html')
        .send(
          html
            .replace(/\{\{APP_NAME\}\}/g, appName)
            .replace(/\{\{FRONTEND_URL\}\}/g, frontend),
        );
    } catch {
      res.status(404).send('Page not found');
    }
  }
}
