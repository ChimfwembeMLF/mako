jest.mock('./generate-content.service', () => ({
  GenerateContentService: class {},
}));

import { DailyContentWorkflowService } from './daily-content-workflow.service';

const baseConfig = {
  id: 'cfg-1',
  workspaceId: 'ws-1',
  isActive: true,
  generateAt: '19:00',
  timezone: 'UTC',
  publishingDays: ['Sat'],
  postingTimes: ['12:00', '09:00'],
  postsPerCycle: 3,
  planAheadDays: 1,
  platforms: ['facebook', 'instagram'],
  lastRunAt: null as Date | null,
  recentRuns: [] as unknown[],
};

function setup(overrides: { config?: Partial<typeof baseConfig> | null; canRun?: boolean; brand?: object | null; generate?: jest.Mock } = {}) {
  const config = overrides.config === null ? null : { ...baseConfig, ...overrides.config };
  let n = 0;
  const generateContent = {
    generate: overrides.generate ?? jest.fn(async () => ({ contentItemId: `item-${++n}` })),
  };
  const subscriptions = {
    canRunDailyWorkflow: jest.fn(async () => (overrides.canRun === false ? { allowed: false, reason: 'Upgrade to Starter' } : { allowed: true })),
    findEligibleForDailyCron: jest.fn(async () => ['tenant-1']),
  };
  const brandProfiles = {
    resolveForContext: jest.fn(async () => (overrides.brand === undefined ? { companyName: 'Chilenje Roasters' } : overrides.brand)),
  };
  const workspaceRepo = { find: jest.fn(async () => [{ id: 'ws-1', tenantId: 'tenant-1', name: 'Main' }]) };
  const tenantRepo = { find: jest.fn(async () => [{ id: 'tenant-1', ownerId: 'owner-1' }]) };
  const automationConfigRepo = {
    find: jest.fn(async () => (config ? [config] : [])),
    save: jest.fn(async (c: unknown) => c),
  };
  const contentRepo = { update: jest.fn(async () => ({})) };
  const service = new DailyContentWorkflowService(
    generateContent as any,
    subscriptions as any,
    brandProfiles as any,
    workspaceRepo as any,
    tenantRepo as any,
    automationConfigRepo as any,
    contentRepo as any,
  );
  return { service, config, generateContent, contentRepo, automationConfigRepo };
}

// Saturday 3 October 2026.
const SAT_1900 = new Date('2026-10-03T19:00:00Z');
const SAT_1907 = new Date('2026-10-03T19:07:00Z');
const SAT_1800 = new Date('2026-10-03T18:00:00Z');

describe('DailyContentWorkflowService.isDue', () => {
  const { service } = setup();

  it('is due at or after the configured time, not only on the exact minute', () => {
    expect(service.isDue(baseConfig as any, SAT_1900)).toBe(true);
    expect(service.isDue(baseConfig as any, SAT_1907)).toBe(true);
    expect(service.isDue(baseConfig as any, SAT_1800)).toBe(false);
  });

  it('runs only once per local day', () => {
    expect(service.isDue({ ...baseConfig, lastRunAt: new Date('2026-10-03T19:01:00Z') } as any, SAT_1907)).toBe(false);
    expect(service.isDue({ ...baseConfig, lastRunAt: new Date('2026-10-02T19:01:00Z') } as any, SAT_1907)).toBe(true);
  });

  it('respects publishing days, the time zone and the on/off switch', () => {
    expect(service.isDue({ ...baseConfig, publishingDays: ['Mon'] } as any, SAT_1907)).toBe(false);
    // 19:07 UTC is 21:07 in Lusaka, so a 20:00 Lusaka time is due.
    expect(service.isDue({ ...baseConfig, timezone: 'Africa/Lusaka', generateAt: '20:00' } as any, SAT_1907)).toBe(true);
    expect(service.isDue({ ...baseConfig, isActive: false } as any, SAT_1907)).toBe(false);
  });
});

describe('DailyContentWorkflowService.planSlots', () => {
  const { service } = setup();

  it('plans ahead to the next publishing day and cycles through posting times', () => {
    const slots = service.planSlots({ ...baseConfig, publishingDays: ['Mon'] } as any, 3, SAT_1900);
    expect(slots).toEqual([
      { date: '2026-10-05', time: '09:00:00' },
      { date: '2026-10-05', time: '12:00:00' },
      { date: '2026-10-05', time: '09:00:00' },
    ]);
  });
});

describe('DailyContentWorkflowService.run', () => {
  it('saves dated drafts for review as the workspace owner on a scheduled run', async () => {
    const { service, generateContent, contentRepo, config } = setup({ config: { publishingDays: [] } });
    const result = await service.run({ userId: 'system', now: SAT_1907 });

    expect(result.generated).toBe(3);
    expect(generateContent.generate).toHaveBeenCalledWith(expect.objectContaining({ userId: 'owner-1', workspaceId: 'ws-1', save: true }));
    expect(contentRepo.update).toHaveBeenCalledWith(
      { id: 'item-1' },
      expect.objectContaining({ status: 'draft', platforms: ['facebook', 'instagram'], scheduledDate: '2026-10-04', scheduledTime: '09:00:00' }),
    );
    expect(config?.lastRunAt).toEqual(SAT_1907);
    expect(config?.recentRuns[0]).toMatchObject({ trigger: 'scheduled', status: 'success', generated: 3 });
  });

  it('does nothing on a scheduled run before the configured time', async () => {
    const { service, generateContent } = setup();
    const result = await service.run({ now: SAT_1800 });
    expect(result.generated).toBe(0);
    expect(generateContent.generate).not.toHaveBeenCalled();
  });

  it('runs straight away when started by hand, even with automation switched off', async () => {
    const { service, generateContent, config } = setup({ config: { isActive: false } });
    const result = await service.run({ tenantId: 'tenant-1', workspaceId: 'ws-1', userId: 'user-9', manual: true, now: SAT_1800 });
    expect(result.generated).toBe(3);
    expect(generateContent.generate).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-9' }));
    expect(config?.recentRuns[0]).toMatchObject({ trigger: 'manual' });
  });

  it('records why a run was skipped when the plan does not allow it', async () => {
    const { service, generateContent, config } = setup({ canRun: false });
    const result = await service.run({ now: SAT_1907 });
    expect(generateContent.generate).not.toHaveBeenCalled();
    expect(result.errors[0]).toContain('Upgrade to Starter');
    expect(config?.recentRuns[0]).toMatchObject({ status: 'skipped' });
  });

  it('stops after the first generation failure and reports a partial run', async () => {
    const generate = jest
      .fn()
      .mockResolvedValueOnce({ contentItemId: 'item-1' })
      .mockRejectedValueOnce(new Error('Monthly AI limit reached'));
    const { service, config } = setup({ generate });
    const result = await service.run({ now: SAT_1907 });
    expect(result.generated).toBe(1);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(config?.recentRuns[0]).toMatchObject({ status: 'partial', generated: 1 });
  });
});
