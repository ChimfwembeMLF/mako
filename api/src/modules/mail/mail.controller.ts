import {
  Controller,
  Delete,
  Get,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GmailConnectService } from './gmail-connect.service';
import { MailService } from './mail.service';

@ApiTags('Mail')
@Controller('api/v1/mail')
export class MailController {
  constructor(
    private readonly gmailConnectService: GmailConnectService,
    private readonly mailService: MailService,
  ) {}

  private getUserId(req: Request): string {
    const userId = req.user?.['sub'] || req.user?.['id'];
    if (!userId) {
      throw new UnauthorizedException('Unable to resolve authenticated user');
    }
    return userId;
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('gmail/status')
  @ApiOperation({ summary: 'Gmail OAuth connection status for current user' })
  gmailStatus(@Req() req: Request) {
    return this.gmailConnectService.getStatus(
      this.getUserId(req),
      this.mailService.isSmtpConfigured(),
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('gmail/connect')
  @ApiOperation({ summary: 'Start Gmail OAuth link flow' })
  gmailConnect(
    @Req() req: Request,
    @Query('returnUrl') returnUrl?: string,
  ) {
    return this.gmailConnectService.getConnectUrl(this.getUserId(req), returnUrl);
  }

  @Get('gmail/callback')
  @ApiOperation({ summary: 'Gmail OAuth callback (redirects to frontend)' })
  async gmailCallback(
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
  ) {
    const { redirectUrl } = await this.gmailConnectService.handleCallback({
      code,
      state,
      error,
      error_description: errorDescription,
    });
    return res.redirect(redirectUrl);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('gmail/disconnect')
  @ApiOperation({ summary: 'Disconnect Gmail OAuth for current user' })
  gmailDisconnect(@Req() req: Request) {
    return this.gmailConnectService.disconnect(this.getUserId(req));
  }
}
