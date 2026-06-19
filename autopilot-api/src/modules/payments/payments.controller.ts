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
    },
  ) {
    return this.payments.initiateDeposit(body);
  }

  @Post('webhooks/deposit')
  @ApiExcludeEndpoint()
  webhook(@Body() body: { depositId?: string; status?: string }) {
    if (body.status === 'COMPLETED' && body.depositId) {
      return this.payments.completeDeposit(body.depositId);
    }
    return { received: true };
  }

  @Post('deposits/check-pending')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  checkPending() {
    return this.payments.checkPendingDeposits();
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
}
