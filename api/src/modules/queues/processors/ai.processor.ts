import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  QUEUE_AI,
  JOB_AI_TASK,
  JOB_INGEST_DOCUMENT,
  AiTaskJobData,
  IngestDocumentJobData,
} from '../queue.constants';
import { GenerateContentService } from '../../content_items/services/generate-content.service';
import { RepurposeContentService } from '../../content_items/services/repurpose-content.service';
import { AdaptPlatformsService } from '../../content_items/services/adapt-platforms.service';
import { GenerateImageService } from '../../content_items/services/generate-image.service';
import { DailyContentWorkflowService } from '../../content_items/services/daily-content-workflow.service';
import { CommentReplyAiService } from '../../content-publishing/comment-reply-ai.service';
import { KnowledgeIngestService } from '../../chatbot/services/knowledge-ingest.service';

@Processor(QUEUE_AI)
export class AiProcessor extends WorkerHost {
  private readonly logger = new Logger(AiProcessor.name);

  constructor(
    private readonly generateContent: GenerateContentService,
    private readonly repurposeContent: RepurposeContentService,
    private readonly adaptPlatforms: AdaptPlatformsService,
    private readonly generateImage: GenerateImageService,
    private readonly dailyWorkflow: DailyContentWorkflowService,
    private readonly commentReplyAi: CommentReplyAiService,
    private readonly knowledgeIngest: KnowledgeIngestService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name === JOB_INGEST_DOCUMENT) {
      const data = job.data as IngestDocumentJobData;
      this.logger.log(`Ingest document ${data.documentId} (job ${job.id})`);
      return this.knowledgeIngest.ingest(data);
    }

    if (job.name !== JOB_AI_TASK) {
      this.logger.warn(`Unknown job: ${job.name}`);
      throw new Error(`Unsupported AI queue job: ${job.name}`);
    }

    const { type, userId, payload } = job.data as AiTaskJobData;
    this.logger.log(`AI task: ${type} (job ${job.id})`);

    switch (type) {
      case 'generate-content':
        return this.generateContent.generate({
          userId,
          tenantId: payload.tenantId as string | undefined,
          workspaceId: (payload.workspaceId ?? payload.workspace_id) as
            | string
            | undefined,
          theme: payload.theme as string | undefined,
          draft: payload.draft as string | undefined,
          contentType: payload.contentType as string | undefined,
          platform: payload.platform as string | undefined,
          templateId: payload.templateId as string | undefined,
          save: payload.save as boolean | undefined,
        });
      case 'repurpose-content':
        return this.repurposeContent.repurpose({
          contentId: String(payload.contentId ?? ''),
          userId,
          targetPlatform: payload.targetPlatform as string | undefined,
        });
      case 'adapt-platforms':
        return this.adaptPlatforms.adapt({
          tenantId: String(payload.tenantId ?? ''),
          userId,
          platforms: payload.platforms as string[],
          title: payload.title as string | undefined,
          content: payload.content as string | undefined,
          workspaceId: payload.workspaceId as string | undefined,
        });
      case 'generate-image':
        return this.generateImage.generateImage({
          tenantId: String(payload.tenantId ?? ''),
          userId,
          prompt: String(payload.prompt ?? ''),
          contentId: payload.contentId as string | undefined,
          contentType: payload.contentType as string | undefined,
        });
      case 'generate-slideshow':
        return this.generateImage.generateSlideshow({
          tenantId: String(payload.tenantId ?? ''),
          userId,
          theme: String(payload.theme ?? ''),
          slideCount: payload.slideCount as number | undefined,
          contentId: payload.contentId as string | undefined,
        });
      case 'daily-workflow':
        return this.dailyWorkflow.run({
          tenantId: payload.tenantId as string | undefined,
          userId,
        });
      case 'suggest-comment-reply':
        return this.commentReplyAi.suggestReply({
          commentReplyId: String(payload.commentReplyId ?? ''),
          userId,
        });
      default:
        throw new Error(`Unsupported AI task type: ${type}`);
    }
  }
}
