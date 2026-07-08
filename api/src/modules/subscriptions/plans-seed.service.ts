import { Injectable, Logger } from '@nestjs/common';
import { SystemSettingsService } from '../system_settings/system_settings.service';
import { BILLING_PLANS_SETTING_KEY, PlansService } from './plans.service';
import { buildDefaultBillingPlans } from './plans-seeds.constants';

@Injectable()
export class PlansSeedService {
  private readonly logger = new Logger(PlansSeedService.name);

  constructor(
    private readonly settings: SystemSettingsService,
    private readonly plans: PlansService,
  ) {}

  /** Seed billing plans into system_settings when missing. Pass force=true to reset defaults. */
  async ensureSeeded(opts?: {
    force?: boolean;
  }): Promise<'created' | 'skipped' | 'reset'> {
    const force = opts?.force ?? false;

    if (!force) {
      try {
        await this.settings.findOne(BILLING_PLANS_SETTING_KEY);
        this.logger.log('Billing plans already seeded — skipping');
        return 'skipped';
      } catch {
        // not found — seed below
      }
    }

    await this.settings.upsert(BILLING_PLANS_SETTING_KEY, {
      value: buildDefaultBillingPlans(),
      description: 'Public billing plans (landing page, billing, payments)',
    });
    await this.plans.refreshCache();

    const action = force ? 'reset' : 'created';
    this.logger.log(`Billing plans ${action}`);
    return action;
  }
}
