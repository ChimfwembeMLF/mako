import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BrandProfilesService } from '../../brand_profiles/brand_profiles.service';
import { Workspaces } from '../../workspaces/entities/workspaces.entity';
import {
  AutomationRun,
  WorkspaceAutomationConfig,
} from '../../workspaces/entities/workspace-automation-config.entity';
import { Tenants } from '../../tenants/entities/tenants.entity';
import { ContentItems } from '../entities/content_items.entity';
import { GenerateContentService } from './generate-content.service';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_RECENT_RUNS = 10;
const DEFAULT_TIMEZONE = 'Africa/Lusaka';

type LocalDate = { year: number; month: number; day: number };

type Target = {
  tenantId: string;
  ownerId: string;
  workspace: Workspaces;
  config: WorkspaceAutomationConfig | null;
};

export type WorkflowResult = { generated: number; skipped: number; errors: string[] };

/** Calendar date and wall-clock minutes for `now` in `timeZone`. */
function localParts(now: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(now)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  );
  return {
    date: { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) } as LocalDate,
    // Intl reports midnight as "24" in some runtimes.
    minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute),
  };
}

function addDays(d: LocalDate, days: number): LocalDate {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day + days));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

function weekday(d: LocalDate): string {
  return DAY_NAMES[new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay()];
}

function isoDate(d: LocalDate): string {
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

function toMinutes(hhmm: string | undefined, fallback: number): number {
  const [h, m] = String(hhmm ?? '').split(':').map(Number);
  return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : fallback;
}

/**
 * Generates each workspace's daily batch of posts from its automation settings.
 * Posts are saved as dated drafts, so nothing publishes until someone approves it.
 */
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
    @InjectRepository(ContentItems)
    private readonly contentRepo: Repository<ContentItems>,
  ) {}

  /**
   * True once per local day, at or after the configured time on a publishing day.
   * Checking "at or after" rather than "exactly at" means a cron that runs every
   * few minutes, or a restart, can't make a day's run be missed.
   */
  isDue(config: Partial<WorkspaceAutomationConfig> | null | undefined, now = new Date()): boolean {
    if (!config?.isActive) return false;
    const timeZone = config.timezone || DEFAULT_TIMEZONE;
    const { date, minutes } = localParts(now, timeZone);

    const days = config.publishingDays?.length ? config.publishingDays : DAY_NAMES;
    if (!days.some((d) => d.toLowerCase() === weekday(date).toLowerCase())) return false;
    if (minutes < toMinutes(config.generateAt, 19 * 60)) return false;

    if (config.lastRunAt) {
      const last = localParts(new Date(config.lastRunAt), timeZone).date;
      if (isoDate(last) === isoDate(date)) return false;
    }
    return true;
  }

  /** The day the batch is planned for and the time each post gets. */
  planSlots(config: Partial<WorkspaceAutomationConfig> | null | undefined, count: number, now = new Date()) {
    const timeZone = config?.timezone || DEFAULT_TIMEZONE;
    const { date } = localParts(now, timeZone);
    const days = config?.publishingDays?.length ? config.publishingDays : DAY_NAMES;
    let target = addDays(date, Math.max(0, config?.planAheadDays ?? 1));
    for (let i = 0; i < 7 && !days.some((d) => d.toLowerCase() === weekday(target).toLowerCase()); i++) {
      target = addDays(target, 1);
    }
    const times = (config?.postingTimes?.length ? [...config.postingTimes] : ['09:00']).sort();
    return Array.from({ length: count }, (_, i) => ({
      date: isoDate(target),
      time: `${times[i % times.length]}:00`.slice(0, 8),
    }));
  }

  /**
   * Scheduled runs (no `manual`) only generate for workspaces that are due.
   * A manual run generates for the given workspace straight away.
   */
  async run(params: {
    tenantId?: string;
    userId?: string;
    workspaceId?: string;
    manual?: boolean;
    now?: Date;
  }): Promise<WorkflowResult> {
    const now = params.now ?? new Date();
    const targets = await this.resolveTargets(params);
    const result: WorkflowResult = { generated: 0, skipped: 0, errors: [] };

    for (const target of targets) {
      if (!params.manual && !this.isDue(target.config, now)) {
        result.skipped++;
        continue;
      }
      const outcome = await this.runForWorkspace(target, params.manual ? params.userId : undefined, now);
      result.generated += outcome.generated;
      if (outcome.status === 'skipped') result.skipped++;
      if (outcome.status !== 'success') result.errors.push(`${target.workspace.name}: ${outcome.message}`);
    }
    return result;
  }

  private async runForWorkspace(target: Target, requestedBy: string | undefined, now: Date): Promise<AutomationRun> {
    const { tenantId, workspace, config } = target;
    // Saved posts need a real author; scheduled runs act as the workspace owner.
    const userId = requestedBy && requestedBy !== 'system' ? requestedBy : target.ownerId;
    const trigger: AutomationRun['trigger'] = requestedBy ? 'manual' : 'scheduled';
    const count = Math.min(10, Math.max(1, config?.postsPerCycle ?? 3));
    const platforms = config?.platforms?.length ? config.platforms : ['facebook'];
    const slots = this.planSlots(config, count, now);

    const record = async (run: Omit<AutomationRun, 'at' | 'trigger' | 'targetDate'>): Promise<AutomationRun> => {
      const entry: AutomationRun = { at: now.toISOString(), trigger, targetDate: slots[0]?.date, ...run };
      if (config) {
        config.lastRunAt = now;
        config.recentRuns = [entry, ...(config.recentRuns ?? [])].slice(0, MAX_RECENT_RUNS);
        await this.automationConfigRepo.save(config);
      }
      return entry;
    };

    const allowed = await this.subscriptions.canRunDailyWorkflow(tenantId);
    if (!allowed.allowed) {
      return record({ status: 'skipped', generated: 0, message: allowed.reason ?? 'Your plan does not include automations.' });
    }

    const brand = await this.brandProfiles.resolveForContext({ tenantId, userId, workspaceId: workspace.id });
    if (!brand?.companyName && !brand?.description) {
      return record({ status: 'skipped', generated: 0, message: 'Set up Brand voice before automations can write posts.' });
    }

    const weekdayName = new Date(`${slots[0].date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    const theme = [
      `${weekdayName} social post for ${brand.companyName || 'your brand'}`,
      brand.keywords ? `Keywords: ${brand.keywords}` : '',
      brand.currentOffers ? `Promote: ${brand.currentOffers}` : '',
      brand.targetAudience ? `Audience: ${brand.targetAudience}` : '',
    ]
      .filter(Boolean)
      .join('. ');

    const createdIds: string[] = [];
    const failures: string[] = [];
    for (let i = 0; i < count; i++) {
      try {
        const out = await this.generateContent.generate({
          userId,
          tenantId,
          workspaceId: workspace.id,
          theme: `${theme} ${i + 1}/${count}`,
          platform: platforms[i % platforms.length],
          save: true,
        });
        if (out.contentItemId) {
          await this.contentRepo.update(
            { id: out.contentItemId },
            {
              platforms,
              scheduledDate: slots[i].date as unknown as Date,
              scheduledTime: slots[i].time,
              status: 'draft',
            },
          );
          createdIds.push(out.contentItemId);
        }
      } catch (err) {
        failures.push(err instanceof Error ? err.message : String(err));
        // One failure (often a usage limit) usually means the rest will fail the same way.
        break;
      }
    }

    const generated = createdIds.length;
    this.logger.log(`Automation ${trigger} run for workspace ${workspace.id}: ${generated}/${count} drafts`);
    if (generated === 0) {
      return record({ status: 'failed', generated, message: failures[0] ?? 'No posts were generated.' });
    }
    return record({
      status: generated < count ? 'partial' : 'success',
      generated,
      message: generated < count
        ? `${generated} of ${count} drafts created. ${failures[0] ?? ''}`.trim()
        : `${generated} draft${generated === 1 ? '' : 's'} ready for review.`,
      contentIds: createdIds,
    });
  }

  private async resolveTargets(params: { tenantId?: string; workspaceId?: string; manual?: boolean }): Promise<Target[]> {
    const tenantIds = params.tenantId
      ? [params.tenantId]
      : await this.subscriptions.findEligibleForDailyCron();
    if (!tenantIds.length) return [];

    const tenants = await this.tenantRepo.find({ where: { id: In(tenantIds) } });
    const targets: Target[] = [];
    for (const tenant of tenants) {
      if (!tenant.ownerId) continue;
      const workspaces = params.workspaceId
        ? await this.workspaceRepo.find({ where: { id: params.workspaceId, tenantId: tenant.id } })
        : await this.workspaceRepo.find({ where: { tenantId: tenant.id } });
      if (!workspaces.length) continue;
      const configs = await this.automationConfigRepo.find({
        where: { workspaceId: In(workspaces.map((w) => w.id)) },
      });
      for (const workspace of workspaces) {
        const config = configs.find((c) => c.workspaceId === workspace.id) ?? null;
        // Scheduled runs only consider workspaces that switched automation on.
        if (!params.manual && !config?.isActive) continue;
        targets.push({ tenantId: tenant.id, ownerId: tenant.ownerId, workspace, config });
      }
    }
    return targets;
  }
}
