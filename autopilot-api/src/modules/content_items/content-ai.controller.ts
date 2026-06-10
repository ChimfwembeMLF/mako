import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  GenerateContentDto,
  GenerateImageDto,
  GenerateSlideshowDto,
  PublishContentDto,
  RepurposeContentDto,
  AdaptPlatformsDto,
  DailyWorkflowDto,
} from './dto/content-ai.dto';
import { GenerateContentService } from './services/generate-content.service';
import { RepurposeContentService } from './services/repurpose-content.service';
import { AdaptPlatformsService } from './services/adapt-platforms.service';
import { GenerateImageService } from './services/generate-image.service';
import { PublishContentService } from './services/publish-content.service';
import { AutoPublishService } from './services/auto-publish.service';
import { DailyContentWorkflowService } from './services/daily-content-workflow.service';

interface JwtUser {
  sub: string;
}

@ApiTags('Content AI')
@Controller('api/v1/content-ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContentAiController {
  constructor(
    private readonly generateContent: GenerateContentService,
    private readonly repurposeContent: RepurposeContentService,
    private readonly adaptPlatforms: AdaptPlatformsService,
    private readonly generateImage: GenerateImageService,
    private readonly publishContent: PublishContentService,
    private readonly autoPublishService: AutoPublishService,
    private readonly dailyWorkflowService: DailyContentWorkflowService,
  ) {}

  @Post('generate')
  generate(@Req() req: { user: JwtUser }, @Body() dto: GenerateContentDto) {
    const workspaceId = dto.workspaceId ?? dto.workspace_id;
    return this.generateContent.generate({
      userId: String(req.user.sub),
      tenantId: dto.tenantId,
      workspaceId,
      theme: dto.theme,
      draft: dto.draft,
      contentType: dto.contentType,
      platform: dto.platform,
      templateId: dto.templateId,
      save: dto.save,
    });
  }

  @Post('repurpose')
  repurpose(@Req() req: { user: JwtUser }, @Body() dto: RepurposeContentDto) {
    return this.repurposeContent.repurpose({
      contentId: dto.contentId,
      userId: String(req.user.sub),
    });
  }

  @Post('adapt-platforms')
  adapt(@Req() req: { user: JwtUser }, @Body() dto: AdaptPlatformsDto) {
    return this.adaptPlatforms.adapt({
      tenantId: dto.tenantId,
      userId: String(req.user.sub),
      platforms: dto.platforms,
      title: dto.title,
      content: dto.content,
    });
  }

  @Post('generate-image')
  image(@Req() req: { user: JwtUser }, @Body() dto: GenerateImageDto) {
    return this.generateImage.generateImage({
      tenantId: dto.tenantId,
      userId: String(req.user.sub),
      prompt: dto.prompt,
      contentId: dto.contentId,
      contentType: dto.contentType,
    });
  }

  @Post('generate-slideshow')
  slideshow(@Req() req: { user: JwtUser }, @Body() dto: GenerateSlideshowDto) {
    return this.generateImage.generateSlideshow({
      tenantId: dto.tenantId,
      userId: String(req.user.sub),
      theme: dto.theme,
      slideCount: dto.slideCount,
      contentId: dto.contentId,
    });
  }

  @Post('auto-publish')
  runAutoPublish() {
    return this.autoPublishService.publishDueItems();
  }

  @Post('daily-workflow')
  runDailyWorkflow(@Req() req: { user: JwtUser }, @Body() dto: DailyWorkflowDto) {
    return this.dailyWorkflowService.run({
      tenantId: dto.tenantId,
      userId: String(req.user.sub),
    });
  }

  @Post(':contentId/publish')
  publish(
    @Req() req: { user: JwtUser },
    @Param('contentId') contentId: string,
    @Body() dto: PublishContentDto,
  ) {
    return this.publishContent.publish({
      contentId,
      userId: String(req.user.sub),
      platforms: dto.platforms,
      platformPayloads: dto.platformPayloads as
        | Record<string, { content?: string; title?: string; media?: Array<{ url: string; type?: string; name?: string }> }>
        | undefined,
    });
  }
}
