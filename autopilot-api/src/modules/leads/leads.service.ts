import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Leads } from './entities/leads.entity';
import { LeadsCreateDto } from './dto/create-leads.dto';
import { LeadsUpdateDto } from './dto/update-leads.dto';
import { scopeWhere } from '../../common/workspace-scope.util';

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(Leads)
    private readonly repo: Repository<Leads>,
  ) {}

  async create(dto: LeadsCreateDto): Promise<Leads> {
    const ent = this.repo.create(dto);
    return this.repo.save(ent as Leads);
  }

  async findAll(tenantId?: string, workspaceId?: string): Promise<Leads[]> {
    if (tenantId) {
      return this.repo.find({
        where: scopeWhere<Leads>(tenantId, workspaceId),
      });
    }
    return this.repo.find();
  }

  async findOne(id: string): Promise<Leads> {
    const ent = await this.repo.findOne({ where: { id } });
    if (!ent) throw new NotFoundException('Leads not found');
    return ent;
  }

  async update(id: string, dto: LeadsUpdateDto): Promise<Leads> {
    await this.repo.update(id, dto as any);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (res.affected === 0) throw new NotFoundException('Leads not found');
  }

  private whatsappEmail(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    return `wa+${digits}@inbox.mako`;
  }

  async findByWhatsappPhone(
    tenantId: string,
    phone: string,
    workspaceId?: string,
  ): Promise<Leads | null> {
    return this.repo.findOne({
      where: {
        ...scopeWhere<Leads>(tenantId, workspaceId),
        email: this.whatsappEmail(phone),
      },
    });
  }

  async upsertFromWhatsapp(params: {
    tenantId: string;
    userId: string;
    phone: string;
    name?: string;
    message: string;
  }): Promise<Leads> {
    const email = this.whatsappEmail(params.phone);
    const existing = await this.repo.findOne({
      where: { tenantId: params.tenantId, email },
    });

    if (existing) {
      existing.message = params.message;
      existing.status =
        existing.status === 'closed' ? 'open' : existing.status ?? 'new';
      if (params.name?.trim() && existing.name.startsWith('WhatsApp ')) {
        existing.name = params.name.trim();
      }
      return this.repo.save(existing);
    }

    return this.repo.save(
      this.repo.create({
        tenantId: params.tenantId,
        userId: params.userId,
        name: params.name?.trim() || `WhatsApp ${params.phone}`,
        email,
        source: 'whatsapp',
        message: params.message,
        status: 'new',
        classification: 'inbound',
      }),
    );
  }
}
