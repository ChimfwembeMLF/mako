import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { TenantsService } from './tenants.service';
import { Tenants } from './entities/tenants.entity';
import { TenantsCreateDto } from './dto/create-tenants.dto';
import { TenantsUpdateDto } from './dto/update-tenants.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Tenants')
@Controller('api/v1/tenants')
export class TenantsController {
  constructor(private readonly service: TenantsService) {}

  @Post()
  create(@Body() dto: TenantsCreateDto): Promise<Tenants> {
    return this.service.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('mine')
  findMine(@Req() req: Request): Promise<Tenants[]> {
    const userId = req.user?.['sub'];
    return this.service.findForUserEnsuringBootstrap(userId);
  }

  @Get()
  findAll(): Promise<Tenants[]> {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Tenants> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: TenantsUpdateDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
