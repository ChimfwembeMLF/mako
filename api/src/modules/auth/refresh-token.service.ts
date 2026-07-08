import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { createHash } from 'crypto';
import { RefreshTokenEntity } from './entities/refresh-token.entity';

@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectRepository(RefreshTokenEntity)
    private readonly repo: Repository<RefreshTokenEntity>,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async save(
    userId: string,
    refreshToken: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.revoke(userId);
    await this.repo.save({
      userId,
      tokenHash: this.hashToken(refreshToken),
      expiresAt,
    });
  }

  async isValid(userId: string, refreshToken: string): Promise<boolean> {
    const record = await this.repo.findOne({ where: { userId } });
    if (!record) return false;
    if (record.expiresAt < new Date()) {
      await this.repo.delete({ id: record.id });
      return false;
    }
    return record.tokenHash === this.hashToken(refreshToken);
  }

  async revoke(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }

  async purgeExpired(): Promise<void> {
    await this.repo.delete({ expiresAt: LessThan(new Date()) });
  }
}
