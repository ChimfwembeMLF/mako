import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutoReplyRules } from './entities/auto_reply_rules.entity';
import { AutoReplyRulesCreateDto } from './dto/create-auto_reply_rules.dto';
import { AutoReplyRulesUpdateDto } from './dto/update-auto_reply_rules.dto';

@Injectable()
export class AutoReplyRulesService {
  constructor(
    @InjectRepository(AutoReplyRules)
    private readonly repo: Repository<AutoReplyRules>,
  ) {}

  async create(dto: AutoReplyRulesCreateDto): Promise<AutoReplyRules> {
    const ent = this.repo.create(dto);
    return this.repo.save(ent as AutoReplyRules);
  }

  async findAll(): Promise<AutoReplyRules[]> {
    return this.repo.find();
  }

  findActiveForPlatform(tenantId: string, platform: string): Promise<AutoReplyRules[]> {
    return this.repo.find({
      where: { tenantId, platform, isActive: true },
      order: { created_at: 'ASC' },
    });
  }

  matchKeywordRule(
    rules: AutoReplyRules[],
    message: string,
  ): AutoReplyRules | null {
    const lower = message.toLowerCase();
    for (const rule of rules) {
      const keywords = rule.triggerKeywords ?? [];
      if (!keywords.length) continue;
      if (keywords.some((kw) => kw.trim() && lower.includes(kw.trim().toLowerCase()))) {
        return rule;
      }
    }
    const catchAll = rules.find((r) => !(r.triggerKeywords?.length));
    return catchAll ?? null;
  }

  async findOne(id: string): Promise<AutoReplyRules> {
    const ent = await this.repo.findOne({ where: { id } });
    if (!ent) throw new NotFoundException('AutoReplyRules not found');
    return ent;
  }

  async update(
    id: string,
    dto: AutoReplyRulesUpdateDto,
  ): Promise<AutoReplyRules> {
    await this.repo.update(id, dto as any);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (res.affected === 0)
      throw new NotFoundException('AutoReplyRules not found');
  }
}
