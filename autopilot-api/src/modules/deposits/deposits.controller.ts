import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { DepositsService } from './deposits.service';
import { Deposits } from './entities/deposits.entity';
import { DepositsCreateDto } from './dto/create-deposits.dto';
import { DepositsUpdateDto } from './dto/update-deposits.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Deposits')
@Controller('api/v1/deposits')
export class DepositsController {
  constructor(private readonly service: DepositsService) {}

  @Post()
  create(@Body() dto: DepositsCreateDto): Promise<Deposits> {
    return this.service.create(dto);
  }

  @Get()
  findAll(): Promise<Deposits[]> {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Deposits> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: DepositsUpdateDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
