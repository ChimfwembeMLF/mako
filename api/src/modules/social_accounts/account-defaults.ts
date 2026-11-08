/** Per-account defaults applied when a post goes out from that account. */
export type AccountDefaults = {
  /** e.g. "#coffee #lusaka" */
  hashtags?: string;
  /** Posted as a comment right after publishing (Facebook and Instagram). */
  firstComment?: string;
};

export const FIRST_COMMENT_PLATFORMS = ['facebook', 'instagram'];

export function accountDefaults(
  account?: { metadata?: Record<string, unknown> | null } | null,
): AccountDefaults {
  const d = account?.metadata?.defaults;
  if (!d || typeof d !== 'object') return {};
  const { hashtags, firstComment } = d as Record<string, unknown>;
  return {
    hashtags: typeof hashtags === 'string' ? hashtags : undefined,
    firstComment: typeof firstComment === 'string' ? firstComment : undefined,
  };
}

/** "coffee, #Lusaka  roast" -> ["#coffee", "#Lusaka", "#roast"] */
export function normalizeHashtags(raw?: string): string[] {
  if (!raw) return [];
  const tags = raw
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, ''))
    .filter(Boolean)
    .map((t) => `#${t}`);
  return [...new Set(tags)];
}

/**
 * Adds the account's default hashtags that the post doesn't already contain. On X it
 * only adds what still fits in 280 characters.
 */
export function appendDefaultHashtags(
  content: string,
  raw: string | undefined,
  platform: string,
): string {
  const existing = new Set(
    (content.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((t) => t.toLowerCase()),
  );
  let tags = normalizeHashtags(raw).filter(
    (t) => !existing.has(t.toLowerCase()),
  );
  if (!tags.length) return content;
  if (platform === 'twitter' || platform === 'x') {
    const fitted: string[] = [];
    for (const t of tags) {
      if (`${content}\n\n${[...fitted, t].join(' ')}`.length <= 280)
        fitted.push(t);
    }
    tags = fitted;
    if (!tags.length) return content;
  }
  return `${content.trimEnd()}\n\n${tags.join(' ')}`;
}
