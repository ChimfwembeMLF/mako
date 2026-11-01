import { Controller, Get, HttpCode, Param, Patch, Body, UseGuards, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { BackofficeService } from './backoffice.service';
import { UpdatePlansDto } from '../subscriptions/dto/update-plans.dto';
import { SendTestSmsDto } from '../sms/send-test-sms.dto';
import { SmsService } from '../sms/sms.service';

@ApiTags('Backoffice')
@Controller('api/v1/backoffice')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@ApiBearerAuth()
export class BackofficeController {
  constructor(
    private readonly backoffice: BackofficeService,
    private readonly sms: SmsService,
  ) {}

  @Post('sms/test')
  @HttpCode(202)
  sendTestSms(@Body() dto: SendTestSmsDto) {
    return this.sms.send({ to: dto.to, message: dto.message });
  }

  @Get('overview')
  overview() {
    return this.backoffice.getOverview();
  }

  @Get('subscriptions')
  listSubscriptions() {
    return this.backoffice.listSubscriptions();
  }

  @Get('tenants')
  tenants() {
    return this.backoffice.listTenants();
  }

  @Get('tenants/:id')
  tenantDetail(@Param('id') id: string) {
    return this.backoffice.getTenantDetail(id);
  }

  @Get('plans')
  plans() {
    return this.backoffice.getPlans();
  }

  @Patch('plans')
  updatePlans(@Body() dto: UpdatePlansDto) {
    return this.backoffice.updatePlans(dto);
  }

  @Get('refunds')
  listRefunds() {
    return this.backoffice.listRefunds();
  }

  @Post('refunds/:id/approve')
  approveRefund(@Param('id') id: string) {
    return this.backoffice.approveRefund(id);
  }

  @Post('refunds/:id/reject')
  rejectRefund(@Param('id') id: string, @Body() body: { notes?: string }) {
    return this.backoffice.rejectRefund(id, body.notes);
  }
}
