import { AiUsageTrackerService } from './ai-usage-tracker.service';
import { IntegrationProvider } from '../../tenants/entities/tenant-integration-config.entity';

describe('AiUsageTrackerService.assertWithinLimit', () => {
  const setup = (preferred: IntegrationProvider | null, keys: IntegrationProvider[]) => {
    const subscriptions = { assertCanUseAi: jest.fn().mockResolvedValue(undefined) };
    const service = Object.create(AiUsageTrackerService.prototype);
    service.subscriptions = subscriptions;
    service.tenantsRepo = { findOne: jest.fn().mockResolvedValue({ preferredAiProvider: preferred }) };
    service.configRepo = {
      findOne: jest.fn(async ({ where }) => (keys.includes(where.provider) ? { id: 'c' } : null)),
    };
    return { service, subscriptions };
  };

  it('skips plan limits when text runs on the tenant key', async () => {
    const { service, subscriptions } = setup(IntegrationProvider.OPENAI, [IntegrationProvider.OPENAI]);
    await service.assertWithinLimit('t', 'u');
    expect(subscriptions.assertCanUseAi).not.toHaveBeenCalled();
  });

  it('applies plan limits with no key', async () => {
    const { service, subscriptions } = setup(null, []);
    await service.assertWithinLimit('t', 'u');
    expect(subscriptions.assertCanUseAi).toHaveBeenCalledWith('t');
  });

  it('applies plan limits when the workspace has not chosen a provider, even with a saved key', async () => {
    // Text then runs on the platform default with the platform key, so it counts against the plan.
    const { service, subscriptions } = setup(null, [IntegrationProvider.MISTRAL]);
    await service.assertWithinLimit('t', 'u');
    expect(subscriptions.assertCanUseAi).toHaveBeenCalledWith('t');
  });

  it('applies plan limits when the chosen provider has no saved key', async () => {
    const { service, subscriptions } = setup(IntegrationProvider.GEMINI, [IntegrationProvider.OPENAI]);
    await service.assertWithinLimit('t', 'u');
    expect(subscriptions.assertCanUseAi).toHaveBeenCalledWith('t');
  });
});
