jest.mock('./generate-content.service', () => ({
  GenerateContentService: class {},
}));

import { DailyContentWorkflowService } from './daily-content-workflow.service';

describe('DailyContentWorkflowService', () => {
  const service = new DailyContentWorkflowService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  it('fires when the automation is enabled on the configured day and time', () => {
    const config = {
      isActive: true,
      generateAt: '19:00',
      timezone: 'UTC',
      publishingDays: ['Sat'],
      postingTimes: ['09:00'],
      postsPerCycle: 3,
      planAheadDays: 1,
      platforms: ['facebook'],
    };

    expect(service.shouldGenerateForConfig(config as any, new Date('2026-10-03T19:00:00Z'))).toBe(true);
  });

  it('skips when automation is paused even if the time matches', () => {
    const config = {
      isActive: false,
      generateAt: '19:00',
      timezone: 'UTC',
      publishingDays: ['Sat'],
      postingTimes: ['09:00'],
      postsPerCycle: 3,
      planAheadDays: 1,
      platforms: ['facebook'],
    };

    expect(service.shouldGenerateForConfig(config as any, new Date('2026-10-03T19:00:00Z'))).toBe(false);
  });
});
