import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Deposits } from './entities/deposits.entity';
import { DepositsCreateDto } from './dto/create-deposits.dto';
import { DepositsUpdateDto } from './dto/update-deposits.dto';

@Injectable()
export class DepositsService {
  constructor(
    @InjectRepository(Deposits)
    private readonly repo: Repository<Deposits>,
  ) {}

  async create(dto: DepositsCreateDto): Promise<Deposits> {
    const ent = this.repo.create(dto);
    return this.repo.save(ent as Deposits);
  }

  async findAll(): Promise<Deposits[]> {
    return this.repo.find();
  }

  async findOne(id: string): Promise<Deposits> {
    const ent = await this.repo.findOne({ where: { id } });
    if (!ent) throw new NotFoundException('Deposits not found');
    return ent;
  }

  async update(id: string, dto: DepositsUpdateDto): Promise<Deposits> {
    await this.repo.update(id, dto as any);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (res.affected === 0) throw new NotFoundException('Deposits not found');
  }
}
