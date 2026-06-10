import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ContentPublicationsService } from './content-publications.service';

@ApiTags('Content Publications')
@Controller('api/v1/content-publications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContentPublicationsController {
  constructor(private readonly service: ContentPublicationsService) {}

  @Get()
  findByTenant(@Query('tenantId') tenantId: string) {
    if (!tenantId) return [];
    return this.service.findPublishedForTenant(tenantId);
  }

  @Get('content/:contentId')
  findByContent(@Param('contentId') contentId: string) {
    return this.service.findByContentId(contentId);
  }
}
