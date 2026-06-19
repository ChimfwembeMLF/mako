import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BrandProfilesService } from '../../brand_profiles/brand_profiles.service';
import { Workspaces } from '../../workspaces/entities/workspaces.entity';
import { Tenants } from '../../tenants/entities/tenants.entity';
import { GenerateContentService } from './generate-content.service';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';

@Injectable()
export class DailyContentWorkflowService {
  private readonly logger = new Logger(DailyContentWorkflowService.name);

  constructor(
    private readonly generateContent: GenerateContentService,
    private readonly subscriptions: SubscriptionsService,
    private readonly brandProfiles: BrandProfilesService,
    @InjectRepository(Workspaces)
    private readonly workspaceRepo: Repository<Workspaces>,
    @InjectRepository(Tenants)
    private readonly tenantRepo: Repository<Tenants>,
  ) {}

  async run(params: {
    tenantId?: string;
    userId?: string;
    workspaceId?: string;
  }): Promise<{ generated: number; skipped: number; errors: string[] }> {
    const targets = await this.resolveTargets(params);
    let generated = 0;
    let skipped = 0;
    const errors: string[] = [];
    const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    for (const target of targets) {
      try {
        const workflowCheck = await this.subscriptions.canRunDailyWorkflow(
          target.tenantId,
        );
        if (!workflowCheck.allowed) {
          skipped++;
          errors.push(`${target.tenantId}: ${workflowCheck.reason}`);
          continue;
        }

        const workspace = target.workspaceId
          ? await this.workspaceRepo.findOne({
              where: { id: target.workspaceId, tenantId: target.tenantId },
            })
          : await this.workspaceRepo.findOne({
              where: { tenantId: target.tenantId },
            });
        if (!workspace) {
          skipped++;
          errors.push(`${target.tenantId}: no workspace found`);
          continue;
        }

        const brand = await this.brandProfiles.resolveForContext({
          tenantId: target.tenantId,
          userId: target.userId,
          workspaceId: workspace.id,
        });
        if (!brand?.companyName && !brand?.description) {
          skipped++;
          errors.push(
            `${target.tenantId}: brand profile incomplete — set up Brand Brain first`,
          );
          continue;
        }

        const theme = [
          `${weekday} social post for ${brand.companyName || 'your brand'}`,
          brand.keywords ? `Keywords: ${brand.keywords}` : '',
          brand.currentOffers ? `Promote: ${brand.currentOffers}` : '',
          brand.targetAudience ? `Audience: ${brand.targetAudience}` : '',
        ]
          .filter(Boolean)
          .join('. ');

        await this.generateContent.generate({
          userId: target.userId,
          tenantId: target.tenantId,
          workspaceId: workspace.id,
          theme,
          save: true,
        });

        generated++;
        this.logger.log(
          `Daily workflow generated content for tenant ${target.tenantId} workspace ${workspace.id}`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${target.tenantId}: ${msg}`);
        this.logger.warn(
          `Daily workflow failed for ${target.tenantId}: ${msg}`,
        );
      }
    }

    return { generated, skipped, errors };
  }

  private async resolveTargets(params: {
    tenantId?: string;
    userId?: string;
    workspaceId?: string;
  }): Promise<
    Array<{ tenantId: string; userId: string; workspaceId?: string }>
  > {
    if (params.tenantId) {
      let userId = params.userId;
      if (!userId) {
        const tenant = await this.tenantRepo.findOne({
          where: { id: params.tenantId },
        });
        userId = tenant?.ownerId;
      }
      if (!userId) return [];
      return [
        { tenantId: params.tenantId, userId, workspaceId: params.workspaceId },
      ];
    }

    const eligibleTenantIds =
      await this.subscriptions.findEligibleForDailyCron();
    const targets: Array<{
      tenantId: string;
      userId: string;
      workspaceId?: string;
    }> = [];

    for (const tenantId of eligibleTenantIds) {
      const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
      if (!tenant?.ownerId) continue;
      const workspace = await this.workspaceRepo.findOne({
        where: { tenantId },
      });
      if (!workspace) continue;
      const brand = await this.brandProfiles.resolveForContext({
        tenantId,
        userId: tenant.ownerId,
        workspaceId: workspace.id,
      });
      if (!brand) continue;
      targets.push({
        tenantId,
        userId: tenant.ownerId,
        workspaceId: workspace.id,
      });
    }

    return targets;
  }
}
