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
import { Request } from 'express';
import { AuditLogsService } from './audit_logs.service';
import { AuditLogs } from './entities/audit_logs.entity';
import { AuditLogsCreateDto } from './dto/create-audit_logs.dto';
import { AuditLogsUpdateDto } from './dto/update-audit_logs.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/v1/audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditLogsController {
  constructor(private readonly service: AuditLogsService) {}

  @Post()
  create(
    @Req() req: Request,
    @Body() dto: AuditLogsCreateDto,
  ): Promise<AuditLogs> {
    const userId = req.user?.['sub'] as string;
    return this.service.create({ ...dto, userId });
  }

  @Get()
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('search') search?: string,
    @Query('module') module?: string,
    @Query('page') page?: string,
    @Query('take') take?: string,
  ) {
    if (tenantId) {
      return this.service.findFiltered({
        tenantId,
        search,
        module,
        page: page ? parseInt(page, 10) : 0,
        take: take ? parseInt(take, 10) : 25,
      });
    }
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<AuditLogs> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: AuditLogsUpdateDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
