import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@Controller('api/v1/payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('mobile-money/options')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  mobileMoneyOptions() {
    return this.payments.listMobileMoneyOptions();
  }

  @Get('fx/quote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  fxQuoteFromZmw(
    @Query('amountZmw') amountZmw: string,
    @Query('currency') currency: string,
  ) {
    return this.payments.quoteFromZmw(Number(amountZmw), currency);
  }

  @Get('fx/convert-to-zmw')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  fxQuoteToZmw(
    @Query('amount') amount: string,
    @Query('currency') currency: string,
  ) {
    return this.payments.quoteToZmw(Number(amount), currency);
  }

  @Post('deposits/initiate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  initiate(
    @Body()
    body: {
      tenantId: string;
      plan: string;
      phone?: string;
      correspondent?: string;
      paymentCountryId?: string;
      currency?: string;
      countryCode?: string;
    },
  ) {
    return this.payments.initiateDeposit(body);
  }

  @Post('ads-deposit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  initiateAdsDeposit(
    @Body()
    body: {
      tenantId: string;
      amount: number;
      phone?: string;
      correspondent?: string;
      paymentCountryId?: string;
      currency?: string;
      countryCode?: string;
    },
    @Req() req: Request,
  ) {
    return this.payments.initiateAdsDeposit(body, req.user?.['sub'] as string);
  }

  @Post('webhooks/deposit')
  @ApiExcludeEndpoint()
  webhook(@Body() body: unknown) {
    return this.payments.handlePawaPayWebhook(body);
  }

  @Post('deposits/check-pending')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  checkPending() {
    return this.payments.checkPendingDeposits();
  }

  @Post('deposits/:depositId/check')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  checkDepositStatus(@Param('depositId') depositId: string) {
    return this.payments.checkDepositStatus(depositId);
  }

  @Get('deposits/tenant/:tenantId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  list(@Param('tenantId') tenantId: string, @Req() req: Request) {
    return this.payments.findByTenant(tenantId, req.user?.['sub'] as string);
  }

  @Get('deposits/:depositId/invoice')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async invoice(
    @Param('depositId') depositId: string,
    @Query('tenantId') tenantId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const pdf = await this.payments.generateInvoicePdf(
      depositId,
      tenantId,
      req.user?.['sub'] as string,
    );
    const filename = this.payments.getInvoiceFilename(depositId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdf.length);
    res.send(pdf);
  }

  @Post('deposits/:depositId/refund-request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  requestRefund(
    @Param('depositId') depositId: string,
    @Body() body: { tenantId: string; reason: string },
    @Req() req: Request,
  ) {
    return this.payments.requestRefund(
      body.tenantId,
      depositId,
      body.reason,
      req.user?.['sub'] as string,
    );
  }
}
