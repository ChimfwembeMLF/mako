import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profiles } from './entities/profiles.entity';
import { ProfilesCreateDto } from './dto/create-profiles.dto';
import { ProfilesUpdateDto } from './dto/update-profiles.dto';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profiles)
    private readonly repo: Repository<Profiles>,
  ) {}

  async create(dto: ProfilesCreateDto): Promise<Profiles> {
    const ent = this.repo.create(dto);
    return this.repo.save(ent as Profiles);
  }

  async findAll(userId?: string): Promise<Profiles[]> {
    if (userId) return this.repo.find({ where: { userId } });
    return this.repo.find();
  }

  async findOne(id: string): Promise<Profiles> {
    const ent = await this.repo.findOne({ where: { id } });
    if (!ent) throw new NotFoundException('Profiles not found');
    return ent;
  }

  async update(id: string, dto: ProfilesUpdateDto): Promise<Profiles> {
    await this.repo.update(id, dto as any);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (res.affected === 0) throw new NotFoundException('Profiles not found');
  }
}
