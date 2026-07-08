import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { QueueDispatchService } from './queue-dispatch.service';
import { ALL_QUEUES } from './queue.constants';

const JOB_STATES = [
  'all',
  'failed',
  'completed',
  'active',
  'waiting',
  'delayed',
  'paused',
] as const;
type JobState = (typeof JOB_STATES)[number];

@ApiTags('Queue Jobs')
@Controller('api/v1/queues')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class QueueJobsController {
  constructor(private readonly dispatch: QueueDispatchService) {}

  @Get('queues')
  listQueues() {
    return { queues: ALL_QUEUES, enabled: this.dispatch.isEnabled() };
  }

  @Get(':queue/stats')
  @UseGuards(SuperAdminGuard)
  getQueueStats(@Param('queue') queue: string) {
    if (!ALL_QUEUES.includes(queue as (typeof ALL_QUEUES)[number])) {
      throw new BadRequestException(`Unknown queue: ${queue}`);
    }
    return this.dispatch.getJobCounts(queue);
  }

  @Get(':queue/jobs')
  @UseGuards(SuperAdminGuard)
  listJobs(
    @Param('queue') queue: string,
    @Query('state') state?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    if (!ALL_QUEUES.includes(queue as (typeof ALL_QUEUES)[number])) {
      throw new BadRequestException(`Unknown queue: ${queue}`);
    }
    const jobState = (state ?? 'all') as JobState;
    if (!JOB_STATES.includes(jobState)) {
      throw new BadRequestException(`Invalid state: ${state}`);
    }
    return this.dispatch.listJobs(
      queue,
      jobState,
      Number(start ?? 0),
      Number(end ?? 49),
    );
  }

  @Get(':queue/jobs/:jobId')
  getJob(@Param('queue') queue: string, @Param('jobId') jobId: string) {
    return this.dispatch.getJobStatus(queue, jobId);
  }

  @Post(':queue/jobs/:jobId/retry')
  @UseGuards(SuperAdminGuard)
  retryJob(@Param('queue') queue: string, @Param('jobId') jobId: string) {
    if (!ALL_QUEUES.includes(queue as (typeof ALL_QUEUES)[number])) {
      throw new BadRequestException(`Unknown queue: ${queue}`);
    }
    return this.dispatch.retryJob(queue, jobId);
  }

  @Post(':queue/retry-failed')
  @UseGuards(SuperAdminGuard)
  retryAllFailed(
    @Param('queue') queue: string,
    @Query('limit') limit?: string,
  ) {
    if (!ALL_QUEUES.includes(queue as (typeof ALL_QUEUES)[number])) {
      throw new BadRequestException(`Unknown queue: ${queue}`);
    }
    return this.dispatch.retryAllFailed(queue, Number(limit ?? 100));
  }
}
