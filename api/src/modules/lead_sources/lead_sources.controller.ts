import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { LeadSourcesService } from './lead_sources.service';
import { LeadSources } from './entities/lead_sources.entity';
import { LeadSourcesCreateDto } from './dto/create-lead_sources.dto';
import { LeadSourcesUpdateDto } from './dto/update-lead_sources.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Lead Source')
@Controller('api/v1/lead-source')
export class LeadSourcesController {
  constructor(private readonly service: LeadSourcesService) {}

  @Post()
  create(@Body() dto: LeadSourcesCreateDto): Promise<LeadSources> {
    return this.service.create(dto);
  }

  @Get()
  findAll(): Promise<LeadSources[]> {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<LeadSources> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: LeadSourcesUpdateDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
