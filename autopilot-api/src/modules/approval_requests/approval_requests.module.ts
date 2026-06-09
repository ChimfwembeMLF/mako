import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalRequests } from './entities/approval_requests.entity';
import { ApprovalWorkflows } from '../approval_workflows/entities/approval_workflows.entity';
import { ApprovalRequestsService } from './approval_requests.service';
import { ApprovalRequestsController } from './approval_requests.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ApprovalRequests, ApprovalWorkflows])],
  providers: [ApprovalRequestsService],
  controllers: [ApprovalRequestsController],
  exports: [ApprovalRequestsService],
})
export class ApprovalRequestsModule {}
