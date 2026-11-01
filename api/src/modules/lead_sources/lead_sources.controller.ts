import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ForbiddenException,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LeadSourcesService } from './lead_sources.service';
import { LeadSources } from './entities/lead_sources.entity';
import { LeadSourcesCreateDto } from './dto/create-lead_sources.dto';
import { LeadSourcesUpdateDto } from './dto/update-lead_sources.dto';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantAccessService } from '../auth/rbac/tenant-access.service';

type AuthedRequest = { user: { sub: string } };

@ApiTags('Lead Source')
@UseGuards(JwtAuthGuard)
@Controller('api/v1/lead-source')
export class LeadSourcesController {
  constructor(
    private readonly service: LeadSourcesService,
    private readonly access: TenantAccessService,
  ) {}

  /** Lead sources hold webhook secrets, so only their owner can reach them. */
  private async ownedSource(userId: string, id: string): Promise<LeadSources> {
    const source = await this.service.findOne(id);
    if (source.userId !== userId && !(await this.access.isSuperAdmin(userId))) {
      throw new ForbiddenException('You do not have access to this lead source');
    }
    return source;
  }

  @Post()
  create(
    @Req() req: AuthedRequest,
    @Body() dto: LeadSourcesCreateDto,
  ): Promise<LeadSources> {
    return this.service.create({ ...dto, userId: req.user.sub });
  }

  @Get()
  findAll(@Req() req: AuthedRequest): Promise<LeadSources[]> {
    return this.service.findForUser(req.user.sub);
  }

  @Get(':id')
  findOne(@Req() req: AuthedRequest, @Param('id') id: string): Promise<LeadSources> {
    return this.ownedSource(req.user.sub, id);
  }

  @Patch(':id')
  async update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: LeadSourcesUpdateDto,
  ) {
    await this.ownedSource(req.user.sub, id);
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.ownedSource(req.user.sub, id);
    return this.service.remove(id);
  }
}
