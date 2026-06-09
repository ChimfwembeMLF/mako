import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogs } from './entities/audit_logs.entity';
import { AuditLogsCreateDto } from './dto/create-audit_logs.dto';
import { AuditLogsUpdateDto } from './dto/update-audit_logs.dto';

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLogs)
    private readonly repo: Repository<AuditLogs>,
  ) {}

  async create(
    dto: AuditLogsCreateDto & { userId: string },
  ): Promise<AuditLogs> {
    const ent = this.repo.create({
      ...dto,
      resourceType: dto.resourceType ?? '',
      resourceId: dto.resourceId ?? NIL_UUID,
    });
    return this.repo.save(ent as AuditLogs);
  }

  async findFiltered(opts: {
    tenantId: string;
    search?: string;
    module?: string;
    page?: number;
    take?: number;
  }): Promise<{ items: Record<string, unknown>[]; total: number }> {
    const page = opts.page ?? 0;
    const take = opts.take ?? 25;

    const qb = this.repo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .where('log.tenantId = :tenantId', { tenantId: opts.tenantId })
      .orderBy('log.created_at', 'DESC')
      .skip(page * take)
      .take(take);

    if (opts.search?.trim()) {
      qb.andWhere('log.action ILIKE :search', {
        search: `%${opts.search.trim()}%`,
      });
    }
    if (opts.module && opts.module !== 'all') {
      qb.andWhere('log.action ILIKE :modulePrefix', {
        modulePrefix: `${opts.module}.%`,
      });
    }

    const [rows, total] = await qb.getManyAndCount();

    const items = rows.map((log) => ({
      id: log.id,
      action: log.action,
      resource_type: log.resourceType || null,
      resource_id: log.resourceId !== NIL_UUID ? log.resourceId : null,
      before_state: log.beforeState ?? null,
      after_state: log.afterState ?? null,
      metadata: log.metadata ?? null,
      created_at: log.created_at,
      profiles: log.user
        ? {
            full_name:
              [log.user.firstName, log.user.lastName]
                .filter(Boolean)
                .join(' ') || null,
            email: log.user.email ?? null,
          }
        : null,
    }));

    return { items, total };
  }

  async findAll(): Promise<AuditLogs[]> {
    return this.repo.find();
  }

  async findOne(id: string): Promise<AuditLogs> {
    const ent = await this.repo.findOne({ where: { id } });
    if (!ent) throw new NotFoundException('AuditLogs not found');
    return ent;
  }

  async update(id: string, dto: AuditLogsUpdateDto): Promise<AuditLogs> {
    await this.repo.update(id, dto as any);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (res.affected === 0) throw new NotFoundException('AuditLogs not found');
  }
}
