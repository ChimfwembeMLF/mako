import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { PaymentFailuresService } from './payment_failures.service';
import { PaymentFailures } from './entities/payment_failures.entity';
import { PaymentFailuresCreateDto } from './dto/create-payment_failures.dto';
import { PaymentFailuresUpdateDto } from './dto/update-payment_failures.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Payment Failures')
@Controller('payment-failures')
export class PaymentFailuresController {
  constructor(private readonly service: PaymentFailuresService) {}

  @Post()
  create(@Body() dto: PaymentFailuresCreateDto): Promise<PaymentFailures> {
    return this.service.create(dto);
  }

  @Get()
  findAll(): Promise<PaymentFailures[]> {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<PaymentFailures> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: PaymentFailuresUpdateDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
