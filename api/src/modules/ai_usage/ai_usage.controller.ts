import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { AiUsageService } from './ai_usage.service';
import { AiUsage } from './entities/ai_usage.entity';
import { AiUsageCreateDto } from './dto/create-ai_usage.dto';
import { AiUsageUpdateDto } from './dto/update-ai_usage.dto';

@Controller('api/v1/ai-usage')
export class AiUsageController {
  constructor(private readonly service: AiUsageService) {}

  @Post()
  create(@Body() dto: AiUsageCreateDto): Promise<AiUsage> {
    return this.service.create(dto);
  }

  @Get()
  findAll(): Promise<AiUsage[]> {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<AiUsage> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: AiUsageUpdateDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
