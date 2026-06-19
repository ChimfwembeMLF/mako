import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { AutoReplyRulesService } from './auto_reply_rules.service';
import { AutoReplyRules } from './entities/auto_reply_rules.entity';
import { AutoReplyRulesCreateDto } from './dto/create-auto_reply_rules.dto';
import { AutoReplyRulesUpdateDto } from './dto/update-auto_reply_rules.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Auto Reply Rules')
@Controller('api/v1/auto-reply-rules')
export class AutoReplyRulesController {
  constructor(private readonly service: AutoReplyRulesService) {}

  @Post()
  create(@Body() dto: AutoReplyRulesCreateDto): Promise<AutoReplyRules> {
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('workspaceId') workspaceId?: string,
  ): Promise<AutoReplyRules[]> {
    return this.service.findAll(tenantId, workspaceId);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<AutoReplyRules> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: AutoReplyRulesUpdateDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
