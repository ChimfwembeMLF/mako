import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  QUEUE_EMAIL,
  JOB_SEND_EMAIL,
  SendEmailJobData,
} from '../queue.constants';
import { LeadEmailService } from '../../leads/services/lead-email.service';

@Processor(QUEUE_EMAIL)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly leadEmail: LeadEmailService) {
    super();
  }

  async process(job: Job<SendEmailJobData>): Promise<unknown> {
    if (job.name !== JOB_SEND_EMAIL) {
      this.logger.warn(`Unknown job: ${job.name}`);
      return null;
    }
    const { to, subject, body, html, userId } = job.data;
    this.logger.log(`Sending email to ${to}`);
    return this.leadEmail.sendLeadEmail({ to, subject, body, html, userId });
  }
}
