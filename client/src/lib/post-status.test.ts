import { describe, expect, it } from 'vitest';
import { getPostActions, getPostDisplayStatus } from './post-status';

const NOW = new Date(2026, 10, 5, 12, 0).getTime();
const post = (over: Partial<Parameters<typeof getPostDisplayStatus>[0]>) => ({
  status: 'draft',
  scheduled_date: null,
  scheduled_time: null,
  publish_failed_reason: null,
  ...over,
});

describe('getPostDisplayStatus', () => {
  it('treats an approved post with a future time as scheduled', () => {
    expect(getPostDisplayStatus(post({ status: 'approved', scheduled_date: '2026-11-06', scheduled_time: '09:00:00' }), NOW)).toBe('scheduled');
  });

  it('marks an approved post whose time has passed as overdue', () => {
    expect(getPostDisplayStatus(post({ status: 'scheduled', scheduled_date: '2026-11-05', scheduled_time: '08:00:00' }), NOW)).toBe('overdue');
  });

  it('reports both stored forms of a failed publish as failed', () => {
    expect(getPostDisplayStatus(post({ status: 'publish_failed' }), NOW)).toBe('failed');
    expect(getPostDisplayStatus(post({ status: 'approved', scheduled_date: '2026-11-06', publish_failed_reason: 'Token expired' }), NOW)).toBe('failed');
  });

  it('keeps a published post published even if one platform reported an error', () => {
    expect(getPostDisplayStatus(post({ status: 'published', publish_failed_reason: 'LinkedIn rejected it' }), NOW)).toBe('published');
  });

  it('separates dated drafts that need approval from plain drafts', () => {
    expect(getPostDisplayStatus(post({ scheduled_date: '2026-11-07' }), NOW)).toBe('needs_approval');
    expect(getPostDisplayStatus(post({}), NOW)).toBe('draft');
  });

  it('shows an approved post with no date as approved', () => {
    expect(getPostDisplayStatus(post({ status: 'approved' }), NOW)).toBe('approved');
  });
});

describe('getPostActions', () => {
  it('offers retry only for failed posts', () => {
    expect(getPostActions('failed').retry).toBe(true);
    expect(getPostActions('scheduled').retry).toBe(false);
  });

  it('offers nothing that changes a published post', () => {
    expect(getPostActions('published')).toEqual({ approve: false, publishNow: false, retry: false, reschedule: false, reject: false });
  });
});
