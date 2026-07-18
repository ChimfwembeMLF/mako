import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantMembers } from '../tenant_members/entities/tenant_members.entity';
import { GmailConnectService } from './gmail-connect.service';
import { GmailInboxSyncService } from './gmail-inbox-sync.service';
import { MailInboxMessagesService } from './mail-inbox-messages.service';
import { MailService } from './mail.service';

@ApiTags('Mail')
@Controller('api/v1/mail')
export class MailController {
  constructor(
    private readonly gmailConnectService: GmailConnectService,
    private readonly mailService: MailService,
    private readonly inboxSync: GmailInboxSyncService,
    private readonly inboxMessages: MailInboxMessagesService,
    @InjectRepository(TenantMembers)
    private readonly membersRepo: Repository<TenantMembers>,
  ) {}

  private getUserId(req: Request): string {
    const userId = req.user?.['sub'] || req.user?.['id'];
    if (!userId) {
      throw new UnauthorizedException('Unable to resolve authenticated user');
    }
    return userId;
  }

  private async assertTenantMembership(userId: string, tenantId: string) {
    const member = await this.membersRepo.findOne({
      where: { userId, tenantId, isActive: true },
    });
    if (!member) {
      throw new ForbiddenException('You do not have access to this tenant');
    }
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
    @Query('tenantId') tenantId?: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    return this.gmailConnectService.getConnectUrl(this.getUserId(req), {
      returnUrl,
      tenantId,
      workspaceId,
    });
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

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('gmail/sync')
  @ApiOperation({ summary: 'Poll Gmail inbox and draft email replies now' })
  async gmailSync(
    @Req() req: Request,
    @Query('tenantId') tenantId: string,
  ) {
    const userId = this.getUserId(req);
    if (!tenantId?.trim()) {
      return this.inboxSync.syncAll();
    }
    await this.assertTenantMembership(userId, tenantId.trim());
    return this.inboxSync.syncForUser(userId, tenantId.trim());
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('drafts')
  @ApiOperation({ summary: 'List AI-generated Gmail draft replies' })
  async listDrafts(
    @Req() req: Request,
    @Query('tenantId') tenantId: string,
    @Query('workspaceId') workspaceId?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = this.getUserId(req);
    if (!tenantId?.trim()) {
      throw new ForbiddenException('tenantId is required');
    }
    await this.assertTenantMembership(userId, tenantId.trim());

    const items = await this.inboxMessages.listDraftReplies({
      tenantId: tenantId.trim(),
      userId,
      workspaceId: workspaceId?.trim() || undefined,
      limit: limit ? Number(limit) : undefined,
    });

    return { items };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('inbox')
  @ApiOperation({ summary: 'List received Gmail inbox messages' })
  async listInbox(
    @Req() req: Request,
    @Query('tenantId') tenantId: string,
    @Query('workspaceId') workspaceId?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = this.getUserId(req);
    if (!tenantId?.trim()) {
      throw new ForbiddenException('tenantId is required');
    }
    await this.assertTenantMembership(userId, tenantId.trim());

    const items = await this.inboxMessages.listInboundMessages({
      tenantId: tenantId.trim(),
      userId,
      workspaceId: workspaceId?.trim() || undefined,
      limit: limit ? Number(limit) : undefined,
    });

    return { items };
  }
}
