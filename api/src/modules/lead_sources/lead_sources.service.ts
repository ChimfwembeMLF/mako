import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { LeadSources } from './entities/lead_sources.entity';
import { LeadSourcesCreateDto } from './dto/create-lead_sources.dto';
import { LeadSourcesUpdateDto } from './dto/update-lead_sources.dto';

@Injectable()
export class LeadSourcesService {
  constructor(
    @InjectRepository(LeadSources)
    private readonly repo: Repository<LeadSources>,
  ) {}

  async create(dto: LeadSourcesCreateDto): Promise<LeadSources> {
    const ent = this.repo.create({
      ...dto,
      webhookSecret:
        dto.webhookSecret?.trim() || randomBytes(24).toString('hex'),
    });
    return this.repo.save(ent as LeadSources);
  }

  async findAll(): Promise<LeadSources[]> {
    return this.repo.find();
  }

  async findOne(id: string): Promise<LeadSources> {
    const ent = await this.repo.findOne({ where: { id } });
    if (!ent) throw new NotFoundException('LeadSources not found');
    return ent;
  }

  async update(id: string, dto: LeadSourcesUpdateDto): Promise<LeadSources> {
    await this.repo.update(id, dto as any);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (res.affected === 0)
      throw new NotFoundException('LeadSources not found');
  }
}
