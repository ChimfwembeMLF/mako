import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

interface JwtUser {
  sub: string;
}

@ApiTags('Notifications')
@Controller('api/v1/notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantId: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notifications.listForUser(String(req.user.sub), tenantId, {
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Get('unread-count')
  unreadCount(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantId: string,
  ) {
    return this.notifications
      .unreadCount(String(req.user.sub), tenantId)
      .then((count) => ({ count }));
  }

  @Patch(':id/read')
  markRead(@Req() req: { user: JwtUser }, @Param('id') id: string) {
    return this.notifications.markRead(String(req.user.sub), id);
  }

  @Post('mark-all-read')
  markAllRead(
    @Req() req: { user: JwtUser },
    @Body() body: { tenantId: string },
  ) {
    return this.notifications.markAllRead(String(req.user.sub), body.tenantId);
  }

  @Get('preferences')
  getPreferences(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantId: string,
  ) {
    return this.notifications.getPreferences(String(req.user.sub), tenantId);
  }

  @Patch('preferences')
  updatePreferences(
    @Req() req: { user: JwtUser },
    @Body()
    body: {
      tenantId: string;
      emailPublishSuccess?: boolean;
      emailBilling?: boolean;
      emailWeeklyDigest?: boolean;
      emailHotLeads?: boolean;
      inAppEnabled?: boolean;
    },
  ) {
    const { tenantId, ...patch } = body;
    return this.notifications.updatePreferences(
      String(req.user.sub),
      tenantId,
      patch,
    );
  }

  @Get('reports/catalog')
  reportCatalog() {
    return this.notifications.listReportCatalog();
  }

  @Get('reports/:reportId/export')
  async exportReport(
    @Query('tenantId') tenantId: string,
    @Query('format') format: string,
    @Param('reportId') reportId: string,
    @Res() res: Response,
  ) {
    const fmt = (format ?? 'csv').toLowerCase();
    if (fmt !== 'pdf' && fmt !== 'csv' && fmt !== 'xlsx') {
      throw new BadRequestException('format must be pdf, csv, or xlsx');
    }
    const { buffer, filename, mime } = await this.notifications.exportReport(
      tenantId,
      reportId,
      fmt,
    );
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }

  @Get('reports/:reportId')
  generateReport(
    @Query('tenantId') tenantId: string,
    @Param('reportId') reportId: string,
  ) {
    return this.notifications.generateReport(tenantId, reportId);
  }
}
