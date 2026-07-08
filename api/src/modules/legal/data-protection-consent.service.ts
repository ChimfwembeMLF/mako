import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataProtectionConsents } from './entities/data_protection_consents.entity';

export const DATA_PROTECTION_CONSENT_VERSION = '1';

@Injectable()
export class DataProtectionConsentService {
  constructor(
    @InjectRepository(DataProtectionConsents)
    private readonly repo: Repository<DataProtectionConsents>,
  ) {}

  async recordConsent(params: {
    visitorId: string;
    userId?: string;
    consentVersion?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const version = params.consentVersion ?? DATA_PROTECTION_CONSENT_VERSION;
    const existing = await this.repo.findOne({
      where: { visitorId: params.visitorId, consentVersion: version },
      order: { created_at: 'DESC' },
    });
    if (existing?.accepted) {
      if (params.userId && !existing.userId) {
        existing.userId = params.userId;
        await this.repo.save(existing);
      }
      return this.toClient(existing);
    }

    const row = await this.repo.save(
      this.repo.create({
        visitorId: params.visitorId,
        userId: params.userId,
        consentVersion: version,
        accepted: true,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      }),
    );
    return this.toClient(row);
  }

  async hasConsent(
    visitorId: string,
    consentVersion = DATA_PROTECTION_CONSENT_VERSION,
  ) {
    const row = await this.repo.findOne({
      where: { visitorId, consentVersion, accepted: true },
      order: { created_at: 'DESC' },
    });
    return row ? this.toClient(row) : null;
  }

  private toClient(row: DataProtectionConsents) {
    return {
      id: row.id,
      visitorId: row.visitorId,
      userId: row.userId ?? null,
      consentVersion: row.consentVersion,
      accepted: row.accepted,
      createdAt: row.created_at.toISOString(),
    };
  }
}
