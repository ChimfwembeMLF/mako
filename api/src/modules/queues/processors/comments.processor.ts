import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  QUEUE_COMMENTS,
  JOB_SYNC_TENANT_COMMENTS,
  JOB_SYNC_ALL_COMMENTS,
  SyncTenantCommentsJobData,
} from '../queue.constants';
import { FetchCommentsService } from '../../content-publishing/social-comments.service';

@Processor(QUEUE_COMMENTS)
export class CommentsProcessor extends WorkerHost {
  private readonly logger = new Logger(CommentsProcessor.name);

  constructor(private readonly fetchComments: FetchCommentsService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case JOB_SYNC_TENANT_COMMENTS:
        return this.handleSyncTenant(job as Job<SyncTenantCommentsJobData>);
      case JOB_SYNC_ALL_COMMENTS:
        return this.handleSyncAll();
      default:
        this.logger.warn(`Unknown job: ${job.name}`);
        return null;
    }
  }

  private async handleSyncTenant(job: Job<SyncTenantCommentsJobData>) {
    const { tenantId, userId, workspaceId, runAutoReply } = job.data;
    return this.fetchComments.fetchForTenant({
      tenantId,
      userId,
      workspaceId,
      runAutoReply: runAutoReply !== false,
    });
  }

  private async handleSyncAll() {
    return this.fetchComments.fetchAllTenants();
  }
}
