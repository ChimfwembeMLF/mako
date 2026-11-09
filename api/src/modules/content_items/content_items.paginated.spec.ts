import { ContentItemsService } from './content_items.service';

jest.mock('uuid', () => ({ v1: () => 'id', v4: () => 'id' }));
jest.mock('../content_publications/content-publications.service', () => ({
  ContentPublicationsService: class {},
}));

type Where = { sql: string; params?: Record<string, unknown> };

/** A stand-in query builder that records filters and returns canned rows. */
function fakeBuilder(rows: {
  items: unknown[];
  total: number;
  counts: { status: string; count: string }[];
}) {
  const built: Where[][] = [];
  const make = () => {
    const wheres: Where[] = [];
    built.push(wheres);
    const qb: Record<string, unknown> = {};
    const chain = () => qb;
    Object.assign(qb, {
      andWhere: (sql: string, params?: Record<string, unknown>) => {
        wheres.push({ sql, params });
        return qb;
      },
      where: chain,
      orderBy: chain,
      skip: chain,
      take: chain,
      select: chain,
      addSelect: chain,
      groupBy: chain,
      getManyAndCount: async () => [rows.items, rows.total],
      getRawMany: async () => rows.counts,
    });
    return qb;
  };
  return { make, built };
}

function serviceWith(rows: Parameters<typeof fakeBuilder>[0]) {
  const fb = fakeBuilder(rows);
  const repo = { createQueryBuilder: jest.fn(() => fb.make()) };
  const mediaRepo = { find: jest.fn(async () => []) };
  const service = new ContentItemsService(
    repo as never,
    mediaRepo as never,
    {} as never,
  );
  return { service, built: fb.built };
}

describe('ContentItemsService.findPaginated', () => {
  const counts = [
    { status: 'draft', count: '4' },
    { status: 'published', count: '6' },
    { status: 'approved', count: '2' },
    { status: 'scheduled', count: '1' },
    { status: 'publish_failed', count: '2' },
  ];

  it('groups stored statuses into the page tabs', async () => {
    const { service } = serviceWith({ items: [], total: 0, counts });
    const result = await service.findPaginated({
      tenantId: 't1',
      page: 1,
      limit: 10,
    });
    expect(result.statusCounts).toEqual({
      all: 15,
      drafts: 4,
      scheduled: 3,
      published: 6,
      failed: 2,
    });
  });

  it('filters the list by tab but keeps the counts across all tabs', async () => {
    const { service, built } = serviceWith({
      items: [{ id: 'a', status: 'scheduled' }],
      total: 3,
      counts,
    });
    const result = await service.findPaginated({
      tenantId: 't1',
      status: 'scheduled',
    });
    const [listQuery, countQuery] = built;
    expect(listQuery).toContainEqual({
      sql: 'item.status IN (:...statuses)',
      params: { statuses: ['scheduled', 'approved'] },
    });
    expect(countQuery.some((w) => w.sql.includes('item.status IN'))).toBe(
      false,
    );
    expect(result.total).toBe(3);
    expect(result.statusCounts?.all).toBe(15);
  });

  it('searches post text as well as titles', async () => {
    const { service, built } = serviceWith({ items: [], total: 0, counts: [] });
    await service.findPaginated({ tenantId: 't1', search: ' harvest ' });
    expect(built[0]).toContainEqual({
      sql: '(item.title ILIKE :search OR item.content ILIKE :search)',
      params: { search: '%harvest%' },
    });
  });

  it('adds a preview image to each post', async () => {
    const { service } = serviceWith({
      items: [{ id: 'a', status: 'draft' }],
      total: 1,
      counts: [],
    });
    const result = await service.findPaginated({ tenantId: 't1' });
    expect(result.items[0]).toMatchObject({
      id: 'a',
      previewMedia: null,
      mediaCount: 0,
    });
  });
});
