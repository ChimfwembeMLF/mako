import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AiUsage } from './entities/ai_usage.entity';
import { AiUsageCreateDto } from './dto/create-ai_usage.dto';
import { AiUsageUpdateDto } from './dto/update-ai_usage.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class AiUsageService {
  constructor(
    @InjectRepository(AiUsage)
    private readonly repo: Repository<AiUsage>,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async create(dto: AiUsageCreateDto): Promise<AiUsage> {
    const ent = this.repo.create(dto);
    return this.repo.save(ent as AiUsage);
  }

  async findAll(tenantId?: string): Promise<AiUsage[]> {
    if (tenantId) return this.repo.find({ where: { tenantId } });
    return this.repo.find();
  }

  async findOne(id: string): Promise<AiUsage> {
    const ent = await this.repo.findOne({ where: { id } });
    if (!ent) throw new NotFoundException('AiUsage not found');
    return ent;
  }

  async update(id: string, dto: AiUsageUpdateDto): Promise<AiUsage> {
    await this.repo.update(id, dto as any);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (res.affected === 0) throw new NotFoundException('AiUsage not found');
  }

  async checkUsage(tenantId: string, _userId: string): Promise<boolean> {
    if (!tenantId) return true;
    const check = await this.subscriptions.canUseAi(tenantId);
    return check.allowed;
  }

  async assertWithinLimit(tenantId: string, _userId: string): Promise<void> {
    await this.subscriptions.assertCanUseAi(tenantId);
  }
}
