import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalWorkflows } from './entities/approval_workflows.entity';
import { ApprovalWorkflowsCreateDto } from './dto/create-approval_workflows.dto';
import { ApprovalWorkflowsUpdateDto } from './dto/update-approval_workflows.dto';

@Injectable()
export class ApprovalWorkflowsService {
  constructor(
    @InjectRepository(ApprovalWorkflows)
    private readonly repo: Repository<ApprovalWorkflows>,
  ) {}

  async create(dto: ApprovalWorkflowsCreateDto): Promise<ApprovalWorkflows> {
    const ent = this.repo.create(dto);
    return this.repo.save(ent as ApprovalWorkflows);
  }

  async findAll(tenantId?: string): Promise<ApprovalWorkflows[]> {
    if (tenantId) {
      return this.repo.find({
        where: { tenantId },
        order: { actionKey: 'ASC' },
      });
    }
    return this.repo.find({ order: { actionKey: 'ASC' } });
  }

  async findOne(id: string): Promise<ApprovalWorkflows> {
    const ent = await this.repo.findOne({ where: { id } });
    if (!ent) throw new NotFoundException('ApprovalWorkflows not found');
    return ent;
  }

  async update(
    id: string,
    dto: ApprovalWorkflowsUpdateDto,
  ): Promise<ApprovalWorkflows> {
    await this.repo.update(id, dto as any);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (res.affected === 0)
      throw new NotFoundException('ApprovalWorkflows not found');
  }
}
