import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSettings } from './entities/system_settings.entity';
import { SystemSettingsUpsertDto } from './dto/upsert-system_settings.dto';

import { MAKO_THEME } from '../../constants/mako-brand.constants';

export const DEFAULT_THEME = {
  primary: MAKO_THEME.primary,
  secondary: MAKO_THEME.secondary,
  accent: MAKO_THEME.accent,
  radius: MAKO_THEME.radius,
  mode: 'light',
};

@Injectable()
export class SystemSettingsService {
  constructor(
    @InjectRepository(SystemSettings)
    private readonly repo: Repository<SystemSettings>,
  ) {}

  async findAll(): Promise<SystemSettings[]> {
    return this.repo.find({ order: { key: 'ASC' } });
  }

  async findOne(key: string): Promise<SystemSettings> {
    const ent = await this.repo.findOne({ where: { key } });
    if (!ent) throw new NotFoundException(`Setting "${key}" not found`);
    return ent;
  }

  async getTheme(): Promise<Record<string, unknown>> {
    const ent = await this.repo.findOne({ where: { key: 'theme' } });
    return { ...DEFAULT_THEME, ...(ent?.value ?? {}) };
  }

  async upsert(
    key: string,
    dto: SystemSettingsUpsertDto,
  ): Promise<SystemSettings> {
    let ent = await this.repo.findOne({ where: { key } });
    if (ent) {
      ent.value = dto.value;
      if (dto.description !== undefined) ent.description = dto.description;
    } else {
      ent = this.repo.create({
        key,
        value: dto.value,
        description: dto.description,
      });
    }
    return this.repo.save(ent);
  }

  async remove(key: string): Promise<void> {
    const res = await this.repo.delete(key);
    if (res.affected === 0)
      throw new NotFoundException(`Setting "${key}" not found`);
  }
}
