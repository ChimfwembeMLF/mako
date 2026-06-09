import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Roles } from './entities/roles.entity';
import { RolesCreateDto } from './dto/create-roles.dto';
import { RolesUpdateDto } from './dto/update-roles.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Roles)
    private readonly repo: Repository<Roles>,
  ) {}

  async create(dto: RolesCreateDto): Promise<Roles> {
    const ent = this.repo.create(dto);
    return this.repo.save(ent as Roles);
  }

  async findAll(tenantId?: string): Promise<Roles[]> {
    if (tenantId) {
      return this.repo.find({
        where: { tenantId },
        order: { isSystem: 'DESC', name: 'ASC' },
      });
    }
    return this.repo.find({ order: { isSystem: 'DESC', name: 'ASC' } });
  }

  async findOne(id: string): Promise<Roles> {
    const ent = await this.repo.findOne({ where: { id } });
    if (!ent) throw new NotFoundException('Roles not found');
    return ent;
  }

  async update(id: string, dto: RolesUpdateDto): Promise<Roles> {
    await this.repo.update(id, dto as any);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const role = await this.findOne(id);
    if (role.isSystem) throw new BadRequestException('Cannot delete system roles');
    const res = await this.repo.delete(id);
    if (res.affected === 0) throw new NotFoundException('Roles not found');
  }
}
