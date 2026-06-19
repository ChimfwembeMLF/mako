import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPermissions } from './entities/user_permissions.entity';
import { UserPermissionsCreateDto } from './dto/create-user_permissions.dto';
import { UserPermissionsUpdateDto } from './dto/update-user_permissions.dto';

@Injectable()
export class UserPermissionsService {
  constructor(
    @InjectRepository(UserPermissions)
    private readonly repo: Repository<UserPermissions>,
  ) {}

  async create(dto: UserPermissionsCreateDto): Promise<UserPermissions> {
    const ent = this.repo.create(dto);
    return this.repo.save(ent as UserPermissions);
  }

  async findAll(
    tenantId?: string,
    userId?: string,
  ): Promise<UserPermissions[]> {
    const where: Record<string, string> = {};
    if (tenantId) where.tenantId = tenantId;
    if (userId) where.userId = userId;
    if (Object.keys(where).length) return this.repo.find({ where });
    return this.repo.find();
  }

  async findOne(id: string): Promise<UserPermissions> {
    const ent = await this.repo.findOne({ where: { id } });
    if (!ent) throw new NotFoundException('UserPermissions not found');
    return ent;
  }

  async update(
    id: string,
    dto: UserPermissionsUpdateDto,
  ): Promise<UserPermissions> {
    await this.repo.update(id, dto as any);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (res.affected === 0)
      throw new NotFoundException('UserPermissions not found');
  }
}
