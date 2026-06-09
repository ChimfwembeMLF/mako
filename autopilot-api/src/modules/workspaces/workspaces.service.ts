import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workspaces } from './entities/workspaces.entity';
import { WorkspacesCreateDto } from './dto/create-workspaces.dto';
import { WorkspacesUpdateDto } from './dto/update-workspaces.dto';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectRepository(Workspaces)
    private readonly repo: Repository<Workspaces>,
  ) {}

  async create(dto: WorkspacesCreateDto): Promise<Workspaces> {
    const ent = this.repo.create(dto);
    return this.repo.save(ent as Workspaces);
  }

  async findAll(tenantId?: string): Promise<Workspaces[]> {
    if (tenantId) {
      return this.repo.find({ where: { tenantId }, order: { created_at: 'ASC' } });
    }
    return this.repo.find();
  }

  async findOne(id: string): Promise<Workspaces> {
    const ent = await this.repo.findOne({ where: { id } });
    if (!ent) throw new NotFoundException('Workspaces not found');
    return ent;
  }

  async update(id: string, dto: WorkspacesUpdateDto): Promise<Workspaces> {
    await this.repo.update(id, dto as any);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (res.affected === 0) throw new NotFoundException('Workspaces not found');
  }
}
