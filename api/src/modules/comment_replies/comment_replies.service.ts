import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommentReplies } from './entities/comment_replies.entity';
import { CommentRepliesCreateDto } from './dto/create-comment_replies.dto';
import { CommentRepliesUpdateDto } from './dto/update-comment_replies.dto';

@Injectable()
export class CommentRepliesService {
  constructor(
    @InjectRepository(CommentReplies)
    private readonly repo: Repository<CommentReplies>,
  ) {}

  async create(dto: CommentRepliesCreateDto): Promise<CommentReplies> {
    const ent = this.repo.create(dto);
    return this.repo.save(ent as CommentReplies);
  }

  async findAll(tenantId?: string): Promise<CommentReplies[]> {
    if (tenantId?.trim()) {
      return this.repo.find({
        where: { tenantId: tenantId.trim() },
        order: { created_at: 'DESC' },
      });
    }
    return this.repo.find({ order: { created_at: 'DESC' } });
  }

  async findOne(id: string): Promise<CommentReplies> {
    const ent = await this.repo.findOne({ where: { id } });
    if (!ent) throw new NotFoundException('CommentReplies not found');
    return ent;
  }

  async update(
    id: string,
    dto: CommentRepliesUpdateDto,
  ): Promise<CommentReplies> {
    await this.repo.update(id, dto as any);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (res.affected === 0)
      throw new NotFoundException('CommentReplies not found');
  }
}
