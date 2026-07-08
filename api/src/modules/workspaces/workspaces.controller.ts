import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { WorkspacesService } from './workspaces.service';
import { Workspaces } from './entities/workspaces.entity';
import { WorkspacesCreateDto } from './dto/create-workspaces.dto';
import { WorkspacesUpdateDto } from './dto/update-workspaces.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface JwtUser {
  sub: string;
}

@ApiTags('Workspaces')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('api/v1/workspaces')
export class WorkspacesController {
  constructor(private readonly service: WorkspacesService) {}

  @Post()
  create(
    @Req() req: { user: JwtUser },
    @Body() dto: WorkspacesCreateDto,
  ): Promise<Workspaces> {
    return this.service.create(dto, String(req.user.sub));
  }

  @Get()
  findAll(@Query('tenantId') tenantId?: string): Promise<Workspaces[]> {
    return this.service.findAll(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Workspaces> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: WorkspacesUpdateDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
