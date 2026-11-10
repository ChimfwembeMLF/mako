jest.mock('./services/lead-classify.service', () => ({ LeadClassifyService: class {} }));

import { LeadCaptureService, commentSource, dmSource } from './lead-capture.service';
import { displayName } from '../mail/from-header.util';

type Row = Record<string, any>;

function setup(opts: { owner?: string | null } = {}) {
  const rows: Row[] = [];
  const matches = (row: Row, where: Row) =>
    Object.entries(where).every(([k, v]) =>
      v && typeof v === 'object' && v._type === 'isNull' ? row[k] == null : row[k] === v,
    );
  const leads = {
    findOne: jest.fn(async ({ where }: { where: Row }) => rows.find((r) => matches(r, where)) ?? null),
    create: jest.fn((data: Row) => ({ ...data })),
    save: jest.fn(async (row: Row) => {
      if (!row.id) {
        row.id = `lead-${rows.length + 1}`;
        rows.push(row);
      }
      return row;
    }),
    update: jest.fn(),
  };
  const tenants = {
    findOne: jest.fn(async () => (opts.owner === null ? null : { ownerId: opts.owner ?? 'owner-1' })),
  };
  const classify = { classify: jest.fn(async () => ({ label: 'warm' })) };
  const service = new LeadCaptureService(leads as any, tenants as any, classify as any);
  return { service, rows, leads, classify };
}

const base = {
  tenantId: 't1',
  workspaceId: 'w1',
  source: 'instagram_dm' as const,
  externalRef: 'instagram:123',
};

describe('LeadCaptureService', () => {
  it('turns a first message into a new lead owned by the organisation owner', async () => {
    const { service, rows } = setup();
    await service.capture({ ...base, name: 'Natasha', message: 'Do you deliver to Roma?' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: 'owner-1',
      name: 'Natasha',
      email: '',
      source: 'instagram_dm',
      externalRef: 'instagram:123',
      status: 'new',
      message: 'Do you deliver to Roma?',
    });
  });

  it('keeps one lead per person and updates it with their latest message', async () => {
    const { service, rows } = setup();
    await service.capture({ ...base, message: 'Hi there, quick question' });
    await service.capture({ ...base, name: 'Natasha', message: 'Do you deliver?' });
    expect(rows).toHaveLength(1);
    expect(rows[0].message).toBe('Do you deliver?');
    // The placeholder name is replaced once their real name is known.
    expect(rows[0].name).toBe('Natasha');
  });

  it('does not let an older synced message replace a newer one', async () => {
    const { service, rows } = setup();
    await service.capture({ ...base, message: 'newest', at: new Date('2026-11-09T10:00:00Z') });
    await service.capture({ ...base, message: 'older', at: new Date('2026-11-01T10:00:00Z') });
    expect(rows[0].message).toBe('newest');
  });

  it('reopens a closed lead when they write again', async () => {
    const { service, rows } = setup();
    await service.capture({ ...base, message: 'first' });
    rows[0].status = 'closed';
    await service.capture({ ...base, message: 'back again' });
    expect(rows[0].status).toBe('open');
  });

  it('matches an email sender to a lead who already filled in a form', async () => {
    const { service, rows } = setup();
    rows.push({ id: 'form-lead', tenantId: 't1', email: 'jo@example.com', name: 'Jo', source: 'contact_form' });
    await service.capture({
      tenantId: 't1',
      workspaceId: null,
      source: 'email',
      externalRef: 'email:jo@example.com',
      email: 'Jo@Example.com',
      message: 'Following up on my form',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'form-lead', externalRef: 'email:jo@example.com', source: 'contact_form' });
  });

  it('upgrades a comment lead found by name once the commenter id is known', async () => {
    const { service, rows } = setup();
    await service.capture({ ...base, source: 'instagram_comment', externalRef: 'instagram:name:bwalya', message: 'Love it' });
    await service.capture({
      ...base,
      source: 'instagram_comment',
      externalRef: 'instagram:999',
      fallbackRef: 'instagram:name:bwalya',
      message: 'Where can I buy it?',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].externalRef).toBe('instagram:999');
  });

  it('skips empty messages and organisations without an owner', async () => {
    const empty = setup();
    await empty.service.capture({ ...base, message: '   ' });
    expect(empty.rows).toHaveLength(0);

    const ownerless = setup({ owner: null });
    await ownerless.service.capture({ ...base, message: 'Hello there friend' });
    expect(ownerless.rows).toHaveLength(0);
  });

  it('never throws, so the message itself is still saved', async () => {
    const { service, leads } = setup();
    leads.findOne.mockRejectedValueOnce(new Error('db down'));
    await expect(service.capture({ ...base, message: 'hi there you' })).resolves.toBeNull();
  });

  it('asks the AI to label real questions, not small talk', async () => {
    const { service, classify } = setup();
    await service.capture({ ...base, externalRef: 'instagram:1', message: 'thanks' });
    expect(classify.classify).not.toHaveBeenCalled();
    await service.capture({ ...base, externalRef: 'instagram:2', message: 'How much is a 1kg bag?' });
    expect(classify.classify).toHaveBeenCalledTimes(1);
  });

  it('does not use AI when importing in bulk', async () => {
    const { service, classify } = setup();
    // capture() with classify: false is what the import uses.
    await service.capture({ ...base, message: 'How much is a 1kg bag?', classify: false });
    expect(classify.classify).not.toHaveBeenCalled();
  });
});

describe('lead sources', () => {
  it('maps platforms to message and comment sources', () => {
    expect(dmSource('instagram')).toBe('instagram_dm');
    expect(dmSource('twitter')).toBe('x_dm');
    expect(dmSource('linkedin')).toBeNull();
    expect(commentSource('youtube')).toBe('youtube_comment');
    expect(commentSource('x')).toBe('x_reply');
  });
});

describe('displayName', () => {
  it('reads the name from a From header', () => {
    expect(displayName('"Jo Banda" <jo@example.com>')).toBe('Jo Banda');
    expect(displayName('Jo Banda <jo@example.com>')).toBe('Jo Banda');
    expect(displayName('jo@example.com')).toBeUndefined();
    expect(displayName('"jo@example.com" <jo@example.com>')).toBeUndefined();
  });
});
