import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappContacts } from './entities/whatsapp_contacts.entity';
import { WhatsappContactsCreateDto } from './dto/create-whatsapp_contacts.dto';
import { WhatsappContactsUpdateDto } from './dto/update-whatsapp_contacts.dto';
import { scopeWhere } from '../../common/workspace-scope.util';

@Injectable()
export class WhatsappContactsService {
  constructor(
    @InjectRepository(WhatsappContacts)
    private readonly repo: Repository<WhatsappContacts>,
  ) {}

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  async create(dto: WhatsappContactsCreateDto): Promise<WhatsappContacts> {
    const ent = this.repo.create({
      ...dto,
      phone: this.normalizePhone(dto.phone),
      optedInAt: dto.optedIn ? dto.optedInAt ?? new Date() : undefined,
    });
    return this.repo.save(ent as WhatsappContacts);
  }

  async findByTenant(
    tenantId: string,
    workspaceId?: string,
  ): Promise<WhatsappContacts[]> {
    return this.repo.find({
      where: scopeWhere<WhatsappContacts>(tenantId, workspaceId),
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, tenantId?: string): Promise<WhatsappContacts> {
    const ent = await this.repo.findOne({
      where: tenantId ? { id, tenantId } : { id },
    });
    if (!ent) throw new NotFoundException('WhatsApp contact not found');
    return ent;
  }

  async update(
    id: string,
    dto: WhatsappContactsUpdateDto,
    tenantId?: string,
  ): Promise<WhatsappContacts> {
    await this.findOne(id, tenantId);
    const patch = { ...dto } as Partial<WhatsappContacts>;
    if (dto.phone) patch.phone = this.normalizePhone(dto.phone);
    if (dto.optedIn === true && !dto.optedInAt) patch.optedInAt = new Date();
    await this.repo.update(id, patch);
    return this.findOne(id, tenantId);
  }

  async remove(id: string, tenantId?: string): Promise<void> {
    await this.findOne(id, tenantId);
    const res = await this.repo.delete(id);
    if (res.affected === 0)
      throw new NotFoundException('WhatsApp contact not found');
  }
}
