import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentFailures } from './entities/payment_failures.entity';
import { PaymentFailuresCreateDto } from './dto/create-payment_failures.dto';
import { PaymentFailuresUpdateDto } from './dto/update-payment_failures.dto';

@Injectable()
export class PaymentFailuresService {
  constructor(
    @InjectRepository(PaymentFailures)
    private readonly repo: Repository<PaymentFailures>,
  ) {}

  async create(dto: PaymentFailuresCreateDto): Promise<PaymentFailures> {
    const ent = this.repo.create(dto);
    return this.repo.save(ent as PaymentFailures);
  }

  async findAll(): Promise<PaymentFailures[]> {
    return this.repo.find();
  }

  async findOne(id: string): Promise<PaymentFailures> {
    const ent = await this.repo.findOne({ where: { id } });
    if (!ent) throw new NotFoundException('PaymentFailures not found');
    return ent;
  }

  async update(
    id: string,
    dto: PaymentFailuresUpdateDto,
  ): Promise<PaymentFailures> {
    await this.repo.update(id, dto as any);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (res.affected === 0)
      throw new NotFoundException('PaymentFailures not found');
  }
}
