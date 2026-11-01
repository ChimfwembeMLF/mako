import type { ContentItem } from './api';
import { toDateKey } from './dates';

const dateKeyOf = (post: ContentItem) => String(post.scheduledDate || '').slice(0, 10);

/** Drafts can carry a planned date, but only these will actually publish. */
const isQueued = (post: ContentItem) =>
  !post.publishedAt && ['scheduled', 'approved'].includes((post.status || '').toLowerCase());

export function postsDueToday(posts: ContentItem[]): ContentItem[] {
  const today = toDateKey(new Date());
  return posts.filter((p) => dateKeyOf(p) === today && isQueued(p));
}

export function postsOverdue(posts: ContentItem[]): ContentItem[] {
  const today = toDateKey(new Date());
  return posts.filter((p) => {
    const date = dateKeyOf(p);
    return date && date < today && isQueued(p);
  });
}
