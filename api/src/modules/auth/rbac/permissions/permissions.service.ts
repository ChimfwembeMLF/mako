import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permissions } from './entities/permissions.entity';
import { PermissionsCreateDto } from './dto/create-permissions.dto';
import { PermissionsUpdateDto } from './dto/update-permissions.dto';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permissions)
    private readonly repo: Repository<Permissions>,
  ) {}

  async create(dto: PermissionsCreateDto): Promise<Permissions> {
    const ent = this.repo.create(dto);
    return this.repo.save(ent as Permissions);
  }

  async findAll(): Promise<Permissions[]> {
    return this.repo.find();
  }

  async findOne(key: string): Promise<Permissions> {
    const ent = await this.repo.findOne({ where: { key } });
    if (!ent) throw new NotFoundException('Permissions not found');
    return ent;
  }

  async update(key: string, dto: PermissionsUpdateDto): Promise<Permissions> {
    await this.repo.update(key, dto as any);
    return this.findOne(key);
  }

  async remove(key: string): Promise<void> {
    const res = await this.repo.delete(key);
    if (res.affected === 0)
      throw new NotFoundException('Permissions not found');
  }
}
