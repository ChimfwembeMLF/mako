import type { ContentItem } from './api';
import { toDateKey } from './dates';

const dateKeyOf = (post: ContentItem) => String(post.scheduledDate || '').slice(0, 10);

const isPublished = (post: ContentItem) =>
  Boolean(post.publishedAt) || (post.status || '').toLowerCase() === 'published';

export function postsDueToday(posts: ContentItem[]): ContentItem[] {
  const today = toDateKey(new Date());
  return posts.filter((p) => dateKeyOf(p) === today && !isPublished(p));
}

export function postsOverdue(posts: ContentItem[]): ContentItem[] {
  const today = toDateKey(new Date());
  return posts.filter((p) => {
    const date = dateKeyOf(p);
    return date && date < today && !isPublished(p);
  });
}
