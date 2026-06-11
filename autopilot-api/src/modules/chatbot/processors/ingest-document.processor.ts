import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  QUEUE_AI,
  JOB_INGEST_DOCUMENT,
  IngestDocumentJobData,
} from '../../queues/queue.constants';
import { KnowledgeIngestService } from '../services/knowledge-ingest.service';

@Processor(QUEUE_AI)
export class IngestDocumentProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestDocumentProcessor.name);

  constructor(private readonly ingest: KnowledgeIngestService) {
    super();
  }

  async process(job: Job<IngestDocumentJobData>): Promise<unknown> {
    if (job.name !== JOB_INGEST_DOCUMENT) return null;

    this.logger.log(`Ingest document ${job.data.documentId} (job ${job.id})`);
    return this.ingest.ingest(job.data);
  }
}
