import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type CronHealthStatus = 'healthy' | 'running' | 'failed' | 'stale';

export interface CronHealthMetric {
  key: string;
  name: string;
  enabled: boolean;
  status: CronHealthStatus;
  lastStartedAt?: string;
  lastFinishedAt?: string;
  lastSuccessAt?: string;
  lastError?: string;
  runCount: number;
  recentEvents: string[];
}

const CRON_KEYS = [
  'auto-publish',
  'daily-workflow',
  'comment-sync',
] as const;

@Injectable()
export class CronMonitorService {
  private readonly metrics = new Map<string, CronHealthMetric>();

  constructor(private readonly config: ConfigService) {}

  recordStart(key: string, name: string) {
    const metric = this.getOrCreateMetric(key, name);
    metric.status = 'running';
    metric.lastStartedAt = new Date().toISOString();
    metric.recentEvents = this.pushEvent(metric.recentEvents, `${name} started`);
    this.metrics.set(key, metric);
  }

  recordSuccess(key: string, name: string, detail?: string) {
    const metric = this.getOrCreateMetric(key, name);
    const now = new Date().toISOString();
    metric.status = 'healthy';
    metric.lastFinishedAt = now;
    metric.lastSuccessAt = now;
    metric.runCount += 1;
    metric.recentEvents = this.pushEvent(
      metric.recentEvents,
      detail ? `${name} succeeded — ${detail}` : `${name} succeeded`,
    );
    this.metrics.set(key, metric);
  }

  recordFailure(key: string, name: string, error: string) {
    const metric = this.getOrCreateMetric(key, name);
    const now = new Date().toISOString();
    metric.status = 'failed';
    metric.lastFinishedAt = now;
    metric.lastError = error;
    metric.recentEvents = this.pushEvent(
      metric.recentEvents,
      `${name} failed — ${error}`,
    );
    this.metrics.set(key, metric);
  }

  getSnapshot(): CronHealthMetric[] {
    return [...CRON_KEYS].map((key) => {
      const metric = this.metrics.get(key);
      if (metric) return { ...metric };

      const name = this.labelForKey(key);
      return {
        key,
        name,
        enabled: this.isEnabled(key),
        status: this.isEnabled(key) ? 'stale' : 'failed',
        recentEvents: [`${name} has not run yet`],
        runCount: 0,
      };
    });
  }

  private getOrCreateMetric(key: string, name: string): CronHealthMetric {
    const existing = this.metrics.get(key);
    if (existing) return existing;

    const metric: CronHealthMetric = {
      key,
      name,
      enabled: this.isEnabled(key),
      status: this.isEnabled(key) ? 'stale' : 'failed',
      recentEvents: [`${name} initialized`],
      runCount: 0,
    };
    this.metrics.set(key, metric);
    return metric;
  }

  private pushEvent(events: string[] = [], next: string): string[] {
    return [next, ...events].slice(0, 5);
  }

  private isEnabled(key: string): boolean {
    switch (key) {
      case 'auto-publish':
        return this.config.get<string>('AUTO_PUBLISH_CRON_ENABLED') !== 'false';
      case 'daily-workflow':
        return this.config.get<string>('DAILY_WORKFLOW_CRON_ENABLED') !== 'false';
      case 'comment-sync':
        return this.config.get<string>('COMMENT_SYNC_CRON_ENABLED') !== 'false';
      default:
        return true;
    }
  }

  private labelForKey(key: string): string {
    switch (key) {
      case 'auto-publish':
        return 'Auto-publish';
      case 'daily-workflow':
        return 'Daily workflow';
      case 'comment-sync':
        return 'Comment sync';
      default:
        return key;
    }
  }
}
