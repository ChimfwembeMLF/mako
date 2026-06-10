import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { TenantMembers } from '../../modules/tenant_members/entities/tenant_members.entity';
import {
  clientIp,
  extractTenantIdFromRequest,
  extractUserId,
} from './audit-request.util';

@Injectable()
export class AuditContextService {
  constructor(
    @InjectRepository(TenantMembers)
    private readonly membersRepo: Repository<TenantMembers>,
  ) {}

  async resolve(req: Request): Promise<{
    userId?: string;
    tenantId?: string;
    ipAddress?: string;
    userAgent?: string;
  }> {
    const userId = extractUserId(req);
    let tenantId = extractTenantIdFromRequest(req);

    if (!tenantId && userId) {
      const member = await this.membersRepo.findOne({
        where: { userId, isActive: true },
        order: { joinedAt: 'ASC' },
      });
      tenantId = member?.tenantId;
    }

    return {
      userId,
      tenantId,
      ipAddress: clientIp(req),
      userAgent: req.headers['user-agent'],
    };
  }
}
