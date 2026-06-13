import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';

class AutoRenewDto {
  @IsBoolean()
  enabled: boolean;
}

@ApiTags('Subscriptions')
@Controller('api/v1/subscriptions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('tenant/:tenantId')
  getForTenant(@Param('tenantId') tenantId: string) {
    return this.subscriptions.getSummary(tenantId);
  }

  @Patch('tenant/:tenantId/auto-renew')
  async setAutoRenew(@Param('tenantId') tenantId: string, @Body() body: AutoRenewDto) {
    await this.subscriptions.setAutoRenew(tenantId, body.enabled);
    return this.subscriptions.getSummary(tenantId);
  }
}
