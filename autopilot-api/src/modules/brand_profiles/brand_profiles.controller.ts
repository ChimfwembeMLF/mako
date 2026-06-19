import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { BrandProfilesService } from './brand_profiles.service';
import { BrandProfiles } from './entities/brand_profiles.entity';
import { BrandProfilesCreateDto } from './dto/create-brand_profiles.dto';
import { BrandProfilesUpdateDto } from './dto/update-brand_profiles.dto';
import { ScrapeWebsiteDto } from './dto/scrape-website.dto';
import { ScrapeWebsiteService } from './services/scrape-website.service';
import { ParseDocumentService } from './services/parse-document.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface JwtUser {
  sub: string;
}

@ApiTags('Brand Profiles')
@Controller('api/v1/brand-profiles')
export class BrandProfilesController {
  constructor(
    private readonly service: BrandProfilesService,
    private readonly scrapeWebsite: ScrapeWebsiteService,
    private readonly parseDocument: ParseDocumentService,
  ) {}

  @Post('scrape-website')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  scrape(@Req() req: { user: JwtUser }, @Body() dto: ScrapeWebsiteDto) {
    const tenantId = dto.tenantId ?? '';
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }
    return this.scrapeWebsite.scrape({
      url: dto.url,
      tenantId,
      userId: String(req.user.sub),
    });
  }

  @Post('parse-document')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  parse(
    @Req() req: { user: JwtUser },
    @UploadedFile() file: Express.Multer.File,
    @Body('tenantId') tenantId: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('file is required');
    }
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }
    return this.parseDocument.parse({
      buffer: file.buffer,
      mimeType: file.mimetype,
      fileName: file.originalname,
      tenantId,
      userId: String(req.user.sub),
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  create(
    @Req() req: { user: JwtUser },
    @Body() dto: BrandProfilesCreateDto,
  ): Promise<BrandProfiles> {
    const userId = String(req.user.sub);
    if (!userId) {
      throw new BadRequestException('Authenticated user is required');
    }
    return this.service.upsert({
      ...dto,
      userId,
    });
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  findAll(@Query('tenantId') tenantId?: string): Promise<BrandProfiles[]> {
    return tenantId
      ? this.service.findForTenant(tenantId)
      : this.service.findAll();
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  findMine(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantId: string,
    @Query('workspaceId') workspaceId?: string,
  ): Promise<BrandProfiles | null> {
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }
    return this.service.resolveForContext({
      tenantId,
      userId: String(req.user.sub),
      workspaceId: workspaceId || undefined,
    });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  findOne(@Param('id') id: string): Promise<BrandProfiles> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  update(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Body() dto: BrandProfilesUpdateDto,
  ) {
    return this.service.updateForUser(id, String(req.user.sub), dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
