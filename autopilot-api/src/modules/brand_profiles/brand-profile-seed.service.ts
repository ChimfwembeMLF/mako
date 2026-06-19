import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { BrandProfiles } from './entities/brand_profiles.entity';
import { Workspaces } from '../workspaces/entities/workspaces.entity';
import { UserEntity } from '../user/user.entity';

@Injectable()
export class BrandProfileSeedService {
  private readonly logger = new Logger(BrandProfileSeedService.name);

  constructor(
    @InjectRepository(BrandProfiles)
    private readonly repo: Repository<BrandProfiles>,
    @InjectRepository(Workspaces)
    private readonly workspaceRepo: Repository<Workspaces>,
  ) {}

  /** Minimal brand profile shell on the default workspace (not tenant-level legacy). */
  async ensureStarterForUser(
    tenantId: string,
    user: UserEntity,
  ): Promise<boolean> {
    const defaultWorkspace = await this.workspaceRepo.findOne({
      where: { tenantId },
      order: { created_at: 'ASC' },
    });

    if (defaultWorkspace) {
      const onWorkspace = await this.repo.findOne({
        where: { workspaceId: defaultWorkspace.id, tenantId },
      });
      if (onWorkspace) return false;

      const legacy = await this.repo.findOne({
        where: { tenantId, userId: user.id, workspaceId: IsNull() },
      });
      if (legacy) {
        legacy.workspaceId = defaultWorkspace.id;
        await this.repo.save(legacy);
        this.logger.log(
          `Moved legacy brand profile to workspace ${defaultWorkspace.id}`,
        );
        return true;
      }
    }

    const existingLegacy = await this.repo.findOne({
      where: { tenantId, userId: user.id, workspaceId: IsNull() },
    });
    if (existingLegacy) return false;

    const companyName =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.email?.split('@')[0]?.trim() ||
      undefined;

    if (!companyName) return false;

    await this.repo.save(
      this.repo.create({
        tenantId,
        userId: user.id,
        workspaceId: defaultWorkspace?.id,
        companyName: defaultWorkspace?.name ?? companyName,
        toneOfVoice: 'Professional, clear, and friendly',
        brandPersonality: 'Helpful and trustworthy',
        description: undefined,
      }),
    );

    this.logger.log(`Seeded starter brand profile for tenant ${tenantId}`);
    return true;
  }
}
