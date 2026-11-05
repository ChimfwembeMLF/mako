import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { ContentPublications } from '../content_publications/entities/content_publications.entity';
import { scopeWhere } from '../../common/workspace-scope.util';

export type PerformanceTotals = {
  posts: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
};

export type PerformanceReport = {
  days: number;
  from: string;
  to: string;
  current: PerformanceTotals;
  /** The same-length period just before `from`, for change indicators. */
  previous: PerformanceTotals;
  daily: Array<{ date: string; posts: number; views: number; engagements: number }>;
  byPlatform: Array<PerformanceTotals & { platform: string }>;
  /** One row per post, with every platform it went out on combined. */
  topPosts: Array<{
    id: string;
    contentId: string;
    platforms: string[];
    title: string;
    publishedAt: string | null;
    views: number;
    likes: number;
    comments: number;
    shares: number;
  }>;
};

const empty = (): PerformanceTotals => ({ posts: 0, views: 0, likes: 0, comments: 0, shares: 0 });

function add(t: PerformanceTotals, p: ContentPublications) {
  t.posts += 1;
  t.views += p.viewCount ?? 0;
  t.likes += p.likeCount ?? 0;
  t.comments += p.commentCount ?? 0;
  t.shares += p.shareCount ?? 0;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function plain(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Published-post performance over a date range, from the stored per-platform publications. */
@Injectable()
export class PerformanceService {
  constructor(
    @InjectRepository(ContentPublications)
    private readonly publications: Repository<ContentPublications>,
  ) {}

  async getReport(tenantId: string, workspaceId: string | undefined, days: number, now = new Date()): Promise<PerformanceReport> {
    const span = Math.min(365, Math.max(1, Math.round(days) || 30));
    const end = new Date(now);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - span);
    start.setUTCHours(0, 0, 0, 0);
    const prevStart = new Date(start);
    prevStart.setUTCDate(prevStart.getUTCDate() - span);

    const rows = await this.publications.find({
      where: {
        ...scopeWhere<ContentPublications>(tenantId, workspaceId),
        status: 'published',
        publishedAt: Between(prevStart, end),
      },
      order: { publishedAt: 'ASC' },
      take: 5000,
    });

    const current = empty();
    const previous = empty();
    const daily = new Map<string, { date: string; posts: number; views: number; engagements: number }>();
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      daily.set(dayKey(d), { date: dayKey(d), posts: 0, views: 0, engagements: 0 });
    }
    const platforms = new Map<string, PerformanceTotals & { platform: string }>();
    const inRange: ContentPublications[] = [];

    for (const row of rows) {
      if (!row.publishedAt) continue;
      const at = new Date(row.publishedAt);
      if (at < prevStart || at > end) continue;
      if (at < start) {
        add(previous, row);
        continue;
      }
      inRange.push(row);
      add(current, row);
      const day = daily.get(dayKey(at));
      if (day) {
        day.posts += 1;
        day.views += row.viewCount ?? 0;
        day.engagements += (row.likeCount ?? 0) + (row.commentCount ?? 0) + (row.shareCount ?? 0);
      }
      const p = platforms.get(row.platform) ?? { platform: row.platform, ...empty() };
      add(p, row);
      platforms.set(row.platform, p);
    }

    const byContent = new Map<string, PerformanceReport['topPosts'][number]>();
    for (const r of inRange) {
      const key = r.contentId ?? r.id;
      const entry = byContent.get(key) ?? {
        id: r.id,
        contentId: r.contentId,
        platforms: [],
        title: r.publishedTitle || plain(r.publishedContent ?? '').slice(0, 90) || 'Untitled post',
        publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
      };
      if (!entry.platforms.includes(r.platform)) entry.platforms.push(r.platform);
      entry.views += r.viewCount ?? 0;
      entry.likes += r.likeCount ?? 0;
      entry.comments += r.commentCount ?? 0;
      entry.shares += r.shareCount ?? 0;
      byContent.set(key, entry);
    }
    const score = (p: { likes: number; comments: number; shares: number }) => p.likes + p.comments + p.shares;
    const topPosts = [...byContent.values()]
      .sort((a, b) => score(b) - score(a) || b.views - a.views)
      .slice(0, 8);

    return {
      days: span,
      from: start.toISOString(),
      to: end.toISOString(),
      current,
      previous,
      daily: [...daily.values()],
      byPlatform: [...platforms.values()].sort(
        (a, b) => b.likes + b.comments + b.shares - (a.likes + a.comments + a.shares),
      ),
      topPosts,
    };
  }
}
