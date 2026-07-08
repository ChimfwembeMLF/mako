import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ApprovalWorkflowsService } from './approval_workflows.service';
import { ApprovalWorkflows } from './entities/approval_workflows.entity';
import { ApprovalWorkflowsCreateDto } from './dto/create-approval_workflows.dto';
import { ApprovalWorkflowsUpdateDto } from './dto/update-approval_workflows.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Approval Workflows')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('api/v1/approval-workflows')
export class ApprovalWorkflowsController {
  constructor(private readonly service: ApprovalWorkflowsService) {}

  @Post()
  create(@Body() dto: ApprovalWorkflowsCreateDto): Promise<ApprovalWorkflows> {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query('tenantId') tenantId?: string): Promise<ApprovalWorkflows[]> {
    return this.service.findAll(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ApprovalWorkflows> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: ApprovalWorkflowsUpdateDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
