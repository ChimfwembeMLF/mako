import {
  Body,
  Controller,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentItems } from './entities/content_items.entity';
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
import { QueueDispatchService } from '../queues/queue-dispatch.service';

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
    private readonly queueDispatch: QueueDispatchService,
    @InjectRepository(ContentItems)
    private readonly contentRepo: Repository<ContentItems>,
  ) {}

  @Post('generate')
  generate(@Req() req: { user: JwtUser }, @Body() dto: GenerateContentDto) {
    const workspaceId = dto.workspaceId ?? dto.workspace_id;
    const payload = {
      tenantId: dto.tenantId,
      workspaceId,
      theme: dto.theme,
      draft: dto.draft,
      contentType: dto.contentType,
      platform: dto.platform,
      templateId: dto.templateId,
      save: dto.save,
    };
    if (this.queueDispatch.isEnabled()) {
      return this.queueDispatch
        .enqueueAiTask({
          type: 'generate-content',
          userId: String(req.user.sub),
          payload,
        })
        .then(({ jobId, queue }) => ({ queued: true, jobId, queue }));
    }
    return this.generateContent.generate({
      userId: String(req.user.sub),
      ...payload,
    });
  }

  @Post('repurpose')
  repurpose(@Req() req: { user: JwtUser }, @Body() dto: RepurposeContentDto) {
    if (this.queueDispatch.isEnabled()) {
      return this.queueDispatch
        .enqueueAiTask({
          type: 'repurpose-content',
          userId: String(req.user.sub),
          payload: { contentId: dto.contentId },
        })
        .then(({ jobId, queue }) => ({ queued: true, jobId, queue }));
    }
    return this.repurposeContent.repurpose({
      contentId: dto.contentId,
      userId: String(req.user.sub),
    });
  }

  @Post('adapt-platforms')
  adapt(@Req() req: { user: JwtUser }, @Body() dto: AdaptPlatformsDto) {
    const workspaceId = dto.workspaceId ?? dto.workspace_id;
    const payload = {
      tenantId: dto.tenantId,
      workspaceId,
      platforms: dto.platforms,
      title: dto.title,
      content: dto.content,
    };
    if (this.queueDispatch.isEnabled()) {
      return this.queueDispatch
        .enqueueAiTask({
          type: 'adapt-platforms',
          userId: String(req.user.sub),
          payload,
        })
        .then(({ jobId, queue }) => ({ queued: true, jobId, queue }));
    }
    return this.adaptPlatforms.adapt({
      userId: String(req.user.sub),
      ...payload,
    });
  }

  @Post('generate-image')
  image(@Req() req: { user: JwtUser }, @Body() dto: GenerateImageDto) {
    const payload = {
      tenantId: dto.tenantId,
      prompt: dto.prompt,
      contentId: dto.contentId,
      contentType: dto.contentType,
    };
    if (this.queueDispatch.isEnabled()) {
      return this.queueDispatch
        .enqueueAiTask({
          type: 'generate-image',
          userId: String(req.user.sub),
          payload,
        })
        .then(({ jobId, queue }) => ({ queued: true, jobId, queue }));
    }
    return this.generateImage.generateImage({
      userId: String(req.user.sub),
      ...payload,
    });
  }

  @Post('generate-slideshow')
  slideshow(@Req() req: { user: JwtUser }, @Body() dto: GenerateSlideshowDto) {
    const payload = {
      tenantId: dto.tenantId,
      theme: dto.theme,
      slideCount: dto.slideCount,
      contentId: dto.contentId,
    };
    if (this.queueDispatch.isEnabled()) {
      return this.queueDispatch
        .enqueueAiTask({
          type: 'generate-slideshow',
          userId: String(req.user.sub),
          payload,
        })
        .then(({ jobId, queue }) => ({ queued: true, jobId, queue }));
    }
    return this.generateImage.generateSlideshow({
      userId: String(req.user.sub),
      ...payload,
    });
  }

  @Post('auto-publish')
  runAutoPublish() {
    if (this.queueDispatch.isEnabled()) {
      return this.queueDispatch
        .enqueueAutoPublishScan()
        .then(({ jobId, queue }) => ({
          queued: true,
          jobId,
          queue,
        }));
    }
    return this.autoPublishService.publishDueItems();
  }

  @Post('daily-workflow')
  runDailyWorkflow(
    @Req() req: { user: JwtUser },
    @Body() dto: DailyWorkflowDto,
  ) {
    const payload = { tenantId: dto.tenantId, workspaceId: dto.workspaceId };
    if (this.queueDispatch.isEnabled()) {
      return this.queueDispatch
        .enqueueAiTask({
          type: 'daily-workflow',
          userId: String(req.user.sub),
          payload,
        })
        .then(({ jobId, queue }) => ({ queued: true, jobId, queue }));
    }
    return this.dailyWorkflowService.run({
      tenantId: dto.tenantId,
      workspaceId: dto.workspaceId,
      userId: String(req.user.sub),
    });
  }

  @Post(':contentId/publish')
  async publish(
    @Req() req: { user: JwtUser },
    @Param('contentId') contentId: string,
    @Body() dto: PublishContentDto,
  ) {
    const item = await this.contentRepo.findOne({ where: { id: contentId } });
    if (!item) throw new NotFoundException('Content item not found');

    await this.contentRepo.update(contentId, {
      publishAttempts: 0,
      publishFailedReason: undefined,
      status: 'approved',
      ...(dto.platforms?.length ? { platforms: dto.platforms } : {}),
      ...(dto.platformPayloads
        ? { platformPayloads: dto.platformPayloads as never }
        : {}),
      ...(dto.contentType ? { contentType: dto.contentType } : {}),
    });

    const data = {
      tenantId: item.tenantId,
      contentId,
      userId: String(req.user.sub),
      platforms: dto.platforms,
      platformPayloads: dto.platformPayloads as
        | Record<
            string,
            {
              content?: string;
              title?: string;
              media?: Array<{ url: string; type?: string; name?: string }>;
            }
          >
        | undefined,
    };
    if (this.queueDispatch.isEnabled()) {
      const { jobId, queue } = await this.queueDispatch.enqueuePublish(data);
      return {
        queued: true,
        jobId,
        queue,
        message: 'Added to publish queue',
      };
    }
    return this.publishContent.publish(data);
  }
}
