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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ContentItemsService } from './content_items.service';
import { ContentItems } from './entities/content_items.entity';
import { ContentItemsCreateDto } from './dto/create-content_items.dto';
import { ContentItemsUpdateDto } from './dto/update-content_items.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MediaService } from '../media/media.service';
import { BrandProfilesService } from '../brand_profiles/brand_profiles.service';

interface JwtUser {
  sub: string;
}

@ApiTags("Content Items")
@Controller('api/v1/content-items')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContentItemsController {
  constructor(
    private readonly service: ContentItemsService,
    private readonly media: MediaService,
    private readonly brandProfiles: BrandProfilesService,
  ) {}

  @Post()
  async create(@Req() req: { user: JwtUser }, @Body() dto: ContentItemsCreateDto): Promise<ContentItems> {
    const userId = String(req.user.sub);
    const enriched: ContentItemsCreateDto = {
      ...dto,
      userId: dto.userId ?? userId,
      brandProfileId: dto.brandProfileId ?? (await this.resolveBrandProfileId(dto.tenantId, userId)),
    };
    return this.service.create(enriched);
  }

  @Get()
  findAll(@Query('tenantId') tenantId?: string): Promise<ContentItems[]> {
    return this.service.findAll(tenantId);
  }

  @Get(':id/details')
  getDetails(@Param('id') id: string) {
    return this.service.getDetails(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ContentItems> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  async update(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Body() dto: ContentItemsUpdateDto,
  ) {
    const enriched = await this.enrichForUpdate(dto, String(req.user.sub));
    return this.service.update(id, enriched);
  }

  @Post(':id/media')
  attachMedia(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Body() body: {
      tenantId: string;
      items: Array<{ url: string; type?: string; assetId?: string }>;
    },
  ) {
    return this.media.attachToContent({
      tenantId: body.tenantId,
      contentId: id,
      items: body.items ?? [],
      userId: String(req.user.sub),
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  private async resolveBrandProfileId(tenantId: string, userId: string): Promise<string | undefined> {
    const brand = await this.brandProfiles.findForTenantUser(tenantId, userId);
    return brand?.id;
  }

  private async enrichForUpdate(dto: ContentItemsUpdateDto, userId: string): Promise<ContentItemsUpdateDto> {
    const enriched: ContentItemsUpdateDto = { ...dto, userId: dto.userId ?? userId };
    if (!enriched.brandProfileId && enriched.tenantId) {
      const brand = await this.brandProfiles.findForTenantUser(enriched.tenantId, userId);
      if (brand?.id) enriched.brandProfileId = brand.id;
    }
    return enriched;
  }
}
