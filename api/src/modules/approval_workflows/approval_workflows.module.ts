import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalWorkflows } from './entities/approval_workflows.entity';
import { ApprovalWorkflowsService } from './approval_workflows.service';
import { ApprovalWorkflowsController } from './approval_workflows.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ApprovalWorkflows])],
  providers: [ApprovalWorkflowsService],
  controllers: [ApprovalWorkflowsController],
  exports: [ApprovalWorkflowsService],
})
export class ApprovalWorkflowsModule {}
