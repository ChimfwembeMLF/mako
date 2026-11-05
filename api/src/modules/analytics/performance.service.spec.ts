import { PerformanceService } from './performance.service';

const pub = (over: Record<string, unknown>) => ({
  id: String(Math.random()),
  contentId: 'c1',
  platform: 'facebook',
  publishedTitle: 'Post',
  publishedContent: '<p>Body</p>',
  viewCount: 0,
  likeCount: 0,
  commentCount: 0,
  shareCount: 0,
  ...over,
});

describe('PerformanceService', () => {
  const now = new Date('2026-11-05T12:00:00Z');

  it('splits totals into the range and the period before it', async () => {
    const repo = {
      find: jest.fn(async () => [
        pub({ publishedAt: new Date('2026-10-01T10:00:00Z'), viewCount: 100, likeCount: 5 }),
        pub({ publishedAt: new Date('2026-11-01T10:00:00Z'), viewCount: 300, likeCount: 20, commentCount: 4 }),
        pub({ publishedAt: new Date('2026-11-03T10:00:00Z'), platform: 'instagram', viewCount: 50, shareCount: 2 }),
      ]),
    };
    const report = await new PerformanceService(repo as any).getReport('t1', 'w1', 7, now);

    expect(report.current).toEqual({ posts: 2, views: 350, likes: 20, comments: 4, shares: 2 });
    expect(report.previous.posts).toBe(0);
    expect(report.daily.find((d) => d.date === '2026-11-01')).toEqual({ date: '2026-11-01', posts: 1, views: 300, engagements: 24 });
    expect(report.byPlatform.map((p) => p.platform)).toEqual(['facebook', 'instagram']);
    expect(report.topPosts).toHaveLength(1);
    expect(report.topPosts[0]).toMatchObject({ platforms: ['facebook', 'instagram'], likes: 20, views: 350 });
  });

  it('counts the earlier same-length window as the previous period', async () => {
    const repo = { find: jest.fn(async () => [pub({ publishedAt: new Date('2026-10-25T10:00:00Z'), likeCount: 3 })]) };
    const report = await new PerformanceService(repo as any).getReport('t1', undefined, 7, now);
    expect(report.previous).toMatchObject({ posts: 1, likes: 3 });
    expect(report.current.posts).toBe(0);
    expect(report.daily).toHaveLength(8);
  });
});
