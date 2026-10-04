import { ConfigService } from '@nestjs/config';
import { CronMonitorService } from './cron-monitor.service';

describe('CronMonitorService', () => {
  it('tracks start, success, and failure for a cron', () => {
    const service = new CronMonitorService(
      { get: () => 'true' } as unknown as ConfigService,
    );

    service.recordStart('auto-publish', 'Auto-publish');
    expect(service.getSnapshot()[0].status).toBe('running');

    service.recordSuccess('auto-publish', 'Auto-publish', '5 jobs processed');
    expect(service.getSnapshot()[0].status).toBe('healthy');
    expect(service.getSnapshot()[0].runCount).toBe(1);

    service.recordFailure('auto-publish', 'Auto-publish', 'Database timeout');
    expect(service.getSnapshot()[0].status).toBe('failed');
    expect(service.getSnapshot()[0].lastError).toBe('Database timeout');
  });
});
