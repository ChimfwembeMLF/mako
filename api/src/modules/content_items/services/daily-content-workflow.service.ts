import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BrandProfilesService } from '../../brand_profiles/brand_profiles.service';
import { Workspaces } from '../../workspaces/entities/workspaces.entity';
import { WorkspaceAutomationConfig } from '../../workspaces/entities/workspace-automation-config.entity';
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
    @InjectRepository(WorkspaceAutomationConfig)
    private readonly automationConfigRepo: Repository<WorkspaceAutomationConfig>,
  ) {}

  shouldGenerateForConfig(
    config: Partial<WorkspaceAutomationConfig> | null | undefined,
    now = new Date(),
  ): boolean {
    if (!config || !config.isActive) return false;

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const timeZone = config.timezone || 'UTC';
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);

    const dateMap = Object.fromEntries(
      parts
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    );

    const currentWeekday = dateMap.weekday ?? 'Mon';
    const currentHour = Number(dateMap.hour ?? '0');
    const currentMinute = Number(dateMap.minute ?? '0');

    const configuredDays = config.publishingDays?.length
      ? config.publishingDays
      : dayNames;
    const dayAllowed = configuredDays.some(
      (day) => day.toLowerCase() === currentWeekday.toLowerCase(),
    );
    if (!dayAllowed) return false;

    const generateAt = config.generateAt || '19:00';
    const [targetHour, targetMinute] = generateAt.split(':').map(Number);
    const currentTime = currentHour * 60 + currentMinute;
    const targetTime = Number(targetHour ?? 0) * 60 + Number(targetMinute ?? 0);

    return currentTime === targetTime;
  }

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

        const config = await this.automationConfigRepo.findOne({
          where: { workspaceId: workspace.id },
        });
        if (!this.shouldGenerateForConfig(config)) {
          skipped++;
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

        const postCount = Math.max(1, config?.postsPerCycle ?? 1);
        for (let i = 0; i < postCount; i++) {
          await this.generateContent.generate({
            userId: target.userId,
            tenantId: target.tenantId,
            workspaceId: workspace.id,
            theme: `${theme} ${i + 1}/${postCount}`,
            save: true,
          });
        }

        generated += postCount;
        this.logger.log(
          `Daily workflow generated ${postCount} content item(s) for tenant ${target.tenantId} workspace ${workspace.id}`,
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
      const workspace = params.workspaceId
        ? await this.workspaceRepo.findOne({
            where: { id: params.workspaceId, tenantId: params.tenantId },
          })
        : await this.workspaceRepo.findOne({ where: { tenantId: params.tenantId } });
      if (!workspace) return [];
      const config = await this.automationConfigRepo.findOne({
        where: { workspaceId: workspace.id },
      });
      if (!this.shouldGenerateForConfig(config)) return [];
      return [
        { tenantId: params.tenantId, userId, workspaceId: workspace.id },
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
      const config = await this.automationConfigRepo.findOne({
        where: { workspaceId: workspace.id },
      });
      if (!this.shouldGenerateForConfig(config)) continue;
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
