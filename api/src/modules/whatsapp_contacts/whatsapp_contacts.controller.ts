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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WhatsappContactsService } from './whatsapp_contacts.service';
import { WhatsappContacts } from './entities/whatsapp_contacts.entity';
import { WhatsappContactsCreateDto } from './dto/create-whatsapp_contacts.dto';
import { WhatsappContactsUpdateDto } from './dto/update-whatsapp_contacts.dto';

@ApiTags('WhatsApp Contacts')
@Controller('api/v1/whatsapp/contacts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WhatsappContactsController {
  constructor(private readonly service: WhatsappContactsService) {}

  @Post()
  create(@Body() dto: WhatsappContactsCreateDto): Promise<WhatsappContacts> {
    return this.service.create({
      ...dto,
      optedInAt: dto.optedIn ? dto.optedInAt ?? new Date() : undefined,
    });
  }

  @Get()
  findByTenant(
    @Query('tenantId') tenantId: string,
    @Query('workspaceId') workspaceId?: string,
  ): Promise<WhatsappContacts[]> {
    return this.service.findByTenant(tenantId, workspaceId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ): Promise<WhatsappContacts> {
    return this.service.findOne(id, tenantId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
    @Body() dto: WhatsappContactsUpdateDto,
  ) {
    return this.service.update(id, dto, tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.service.remove(id, tenantId);
  }
}
