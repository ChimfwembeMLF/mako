import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { Permissions } from './entities/permissions.entity';
import { PermissionsCreateDto } from './dto/create-permissions.dto';
import { PermissionsUpdateDto } from './dto/update-permissions.dto';

@Controller('api/v1/permissions')
export class PermissionsController {
  constructor(private readonly service: PermissionsService) {}

  @Post()
  create(@Body() dto: PermissionsCreateDto): Promise<Permissions> {
    return this.service.create(dto);
  }

  @Get()
  findAll(): Promise<Permissions[]> {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Permissions> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: PermissionsUpdateDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
