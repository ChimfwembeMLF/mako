import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GenerateCampaignDto } from './dto/generate-campaign.dto';
import { GenerateCampaignService } from './services/generate-campaign.service';

interface JwtUser {
  sub: string;
}

@ApiTags('Content Campaigns')
@Controller('api/v1/content-campaigns')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContentCampaignsController {
  constructor(private readonly campaigns: GenerateCampaignService) {}

  @Post('generate')
  generate(@Req() req: { user: JwtUser }, @Body() dto: GenerateCampaignDto) {
    return this.campaigns.generate({
      userId: String(req.user.sub),
      tenantId: dto.tenantId,
      workspaceId: dto.workspaceId,
      theme: dto.theme,
      name: dto.name,
      goal: dto.goal,
      platforms: dto.platforms,
      postCount: dto.postCount,
      startDate: dto.startDate,
    });
  }

  @Get()
  list(
    @Query('tenantId') tenantId: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    return this.campaigns.findByTenant(tenantId, workspaceId);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.campaigns.findOne(id, tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.campaigns.remove(id, tenantId);
  }
}
