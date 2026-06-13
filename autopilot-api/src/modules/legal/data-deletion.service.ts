import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { DataDeletionRequests } from './entities/data_deletion_requests.entity';
import { SocialAccounts } from '../social_accounts/entities/social_accounts.entity';
import { RefreshTokenService } from '../auth/refresh-token.service';
import { UserService } from '../user/user.service';

@Injectable()
export class DataDeletionService {
  private readonly logger = new Logger(DataDeletionService.name);

  constructor(
    @InjectRepository(DataDeletionRequests)
    private readonly repo: Repository<DataDeletionRequests>,
    @InjectRepository(SocialAccounts)
    private readonly socialRepo: Repository<SocialAccounts>,
    private readonly config: ConfigService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly users: UserService,
  ) {}

  async requestByEmail(
    email: string,
    meta?: { userId?: string; ipAddress?: string; userAgent?: string },
  ): Promise<{
    id: string;
    confirmationCode: string;
    status: string;
    createdAt: string;
  }> {
    const code = randomBytes(12).toString('hex');
    const row = await this.repo.save(
      this.repo.create({
        confirmationCode: code,
        email: email.trim().toLowerCase(),
        platform: 'email',
        userId: meta?.userId,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      }),
    );
    void this.processDeletion(code).catch((err) => this.logger.error('Deletion failed', err));
    return {
      id: row.id,
      confirmationCode: code,
      status: row.status,
      createdAt: row.created_at.toISOString(),
    };
  }

  async handleMetaSignedRequest(signedRequest: string): Promise<{ url: string; confirmation_code: string }> {
    const secret = this.config.get<string>('FACEBOOK_APP_SECRET') ?? '';
    const payload = this.parseSignedRequest(signedRequest, secret);
    const externalUserId = String(payload.user_id ?? '');
    const code = randomBytes(12).toString('hex');

    await this.repo.save(
      this.repo.create({
        confirmationCode: code,
        platform: 'meta',
        externalUserId,
      }),
    );

    void this.processMetaDeletion(externalUserId, code).catch((err) =>
      this.logger.error('Meta deletion failed', err),
    );

    const frontend = (this.config.get<string>('FRONTEND_URL') ?? '').replace(/\/$/, '');
    return {
      url: `${frontend}/data-deletion?code=${code}`,
      confirmation_code: code,
    };
  }

  async getStatus(code: string) {
    const row = await this.repo.findOne({ where: { confirmationCode: code } });
    if (!row) throw new NotFoundException('Deletion request not found');
    return {
      id: row.id,
      confirmationCode: row.confirmationCode,
      status: row.status,
      platform: row.platform,
      email: row.email ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
    };
  }

  private async processMetaDeletion(facebookUserId: string, code: string) {
    const accounts = await this.socialRepo.find({
      where: { platform: 'facebook' },
    });
    for (const account of accounts) {
      if (account.metadata?.facebook_user_id === facebookUserId || account.externalId === facebookUserId) {
        await this.socialRepo.update(account.id, {
          connected: false,
          accessToken: '',
          refreshToken: undefined,
        } as Partial<SocialAccounts>);
        await this.refreshTokens.revoke(String(account.userId));
      }
    }
    await this.repo.update({ confirmationCode: code }, { status: 'completed', completedAt: new Date() });
  }

  private async processDeletion(code: string) {
    const row = await this.repo.findOne({ where: { confirmationCode: code } });
    if (!row?.email) return;

    const user = await this.users.findOne({ email: row.email });
    if (!user) {
      await this.repo.update({ confirmationCode: code }, { status: 'completed', completedAt: new Date() });
      return;
    }

    await this.socialRepo.delete({ userId: String(user.id) });
    await this.refreshTokens.revoke(String(user.id));
    await this.users.anonymizeUser(String(user.id));
    await this.repo.update({ confirmationCode: code }, { status: 'completed', completedAt: new Date() });
  }

  private parseSignedRequest(signedRequest: string, secret: string): Record<string, unknown> {
    if (!signedRequest || !secret) throw new Error('Invalid signed request');
    const [encodedSig, payload] = signedRequest.split('.');
    if (!encodedSig || !payload) throw new Error('Malformed signed request');

    const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const expected = createHmac('sha256', secret).update(payload).digest();
    if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) {
      throw new Error('Invalid signature');
    }

    return JSON.parse(
      Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    ) as Record<string, unknown>;
  }
}
