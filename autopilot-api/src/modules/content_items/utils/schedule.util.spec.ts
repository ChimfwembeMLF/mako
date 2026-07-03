import { ContentItems } from '../entities/content_items.entity';
import { isContentDue, resolveScheduleDateStr } from './schedule.util';

describe('schedule.util', () => {
  const base = {
    status: 'approved',
    scheduledDate: new Date('2024-06-16T00:00:00.000Z'),
    scheduledTime: '14:30:00',
  } as ContentItems;

  it('resolveScheduleDateStr keeps calendar date from UTC date column', () => {
    expect(resolveScheduleDateStr(new Date('2024-06-16T00:00:00.000Z'))).toBe(
      '2024-06-16',
    );
  });

  it('is due after scheduled local date/time', () => {
    const now = new Date('2024-06-16T15:00:00');
    expect(isContentDue(base, now)).toBe(true);
  });

  it('is not due before scheduled time on same day', () => {
    const now = new Date('2024-06-16T10:00:00');
    expect(isContentDue(base, now)).toBe(false);
  });

  it('is due at midnight when no scheduled time', () => {
    const item = {
      ...base,
      scheduledTime: undefined,
    } as ContentItems;
    expect(isContentDue(item, new Date('2024-06-16T00:01:00'))).toBe(true);
    expect(isContentDue(item, new Date('2024-06-15T23:59:00'))).toBe(false);
  });

  it('ignores non-schedulable status', () => {
    expect(
      isContentDue({ ...base, status: 'draft' } as ContentItems, new Date()),
    ).toBe(false);
  });
});
