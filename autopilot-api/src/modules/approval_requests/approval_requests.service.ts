import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalRequests } from './entities/approval_requests.entity';
import { ApprovalWorkflows } from '../approval_workflows/entities/approval_workflows.entity';
import { ApprovalRequestsCreateDto } from './dto/create-approval_requests.dto';
import { ApprovalRequestsUpdateDto } from './dto/update-approval_requests.dto';

@Injectable()
export class ApprovalRequestsService {
  constructor(
    @InjectRepository(ApprovalRequests)
    private readonly repo: Repository<ApprovalRequests>,
    @InjectRepository(ApprovalWorkflows)
    private readonly workflowsRepo: Repository<ApprovalWorkflows>,
  ) {}

  async create(dto: ApprovalRequestsCreateDto): Promise<ApprovalRequests> {
    const ent = this.repo.create(dto);
    return this.repo.save(ent as ApprovalRequests);
  }

  async findFiltered(opts: {
    tenantId: string;
    status?: string;
    statuses?: string[];
  }): Promise<Record<string, unknown>[]> {
    const qb = this.repo
      .createQueryBuilder('ar')
      .leftJoinAndSelect('ar.requester', 'requester')
      .where('ar.tenantId = :tenantId', { tenantId: opts.tenantId })
      .orderBy('ar.created_at', 'DESC');

    if (opts.status) {
      qb.andWhere('ar.status = :status', { status: opts.status });
    } else if (opts.statuses?.length) {
      qb.andWhere('ar.status IN (:...statuses)', { statuses: opts.statuses });
    }

    const rows = await qb.getMany();
    const workflows = await this.workflowsRepo.find({
      where: { tenantId: opts.tenantId },
    });
    const labelByAction = new Map(
      workflows.map((w) => [w.actionKey, w.label]),
    );

    return rows.map((ar) => ({
      id: ar.id,
      action_key: ar.actionKey,
      resource_type: ar.resourceType,
      resource_id: ar.resourceId,
      payload: ar.payload ?? null,
      status: ar.status,
      requester_notes: ar.requesterNotes ?? null,
      reviewer_notes: ar.reviewerNotes ?? null,
      created_at: ar.created_at,
      reviewed_at: ar.reviewedAt ?? null,
      requested_by: ar.requestedBy,
      profiles: ar.requester
        ? {
            full_name:
              [ar.requester.firstName, ar.requester.lastName]
                .filter(Boolean)
                .join(' ') || null,
            email: ar.requester.email ?? null,
          }
        : null,
      maker_checker_config: {
        label: labelByAction.get(ar.actionKey) ?? ar.actionKey,
      },
    }));
  }

  async findAll(): Promise<ApprovalRequests[]> {
    return this.repo.find();
  }

  async findOne(id: string): Promise<ApprovalRequests> {
    const ent = await this.repo.findOne({ where: { id } });
    if (!ent) throw new NotFoundException('ApprovalRequests not found');
    return ent;
  }

  async update(
    id: string,
    dto: ApprovalRequestsUpdateDto,
  ): Promise<ApprovalRequests> {
    await this.repo.update(id, dto as any);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (res.affected === 0)
      throw new NotFoundException('ApprovalRequests not found');
  }
}
