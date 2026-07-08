import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolePermissions } from './entities/role_permissions.entity';
import { RolePermissionsCreateDto } from './dto/create-role_permissions.dto';
import { RolePermissionsUpdateDto } from './dto/update-role_permissions.dto';

@Injectable()
export class RolePermissionsService {
  constructor(
    @InjectRepository(RolePermissions)
    private readonly repo: Repository<RolePermissions>,
  ) {}

  async create(dto: RolePermissionsCreateDto): Promise<RolePermissions> {
    const ent = this.repo.create(dto);
    return this.repo.save(ent as RolePermissions);
  }

  async findAll(): Promise<RolePermissions[]> {
    return this.repo.find();
  }

  async findOne(
    roleId: string,
    permissionKey: string,
  ): Promise<RolePermissions> {
    const ent = await this.repo.findOne({ where: { roleId, permissionKey } });
    if (!ent) throw new NotFoundException('RolePermissions not found');
    return ent;
  }

  async update(
    roleId: string,
    permissionKey: string,
    dto: RolePermissionsUpdateDto,
  ): Promise<RolePermissions> {
    await this.repo.update({ roleId, permissionKey }, dto as any);
    return this.findOne(roleId, permissionKey);
  }

  async remove(roleId: string, permissionKey: string): Promise<void> {
    const res = await this.repo.delete({ roleId, permissionKey });
    if (res.affected === 0)
      throw new NotFoundException('RolePermissions not found');
  }
}
