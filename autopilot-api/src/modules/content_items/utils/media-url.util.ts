/** Supabase public URLs are used as-is everywhere. */
export function resolvePublicMediaUrl(url: string, _apiPublicBase?: string): string {
  if (!url?.trim()) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return url;
}

/** Normalize stored media URLs — Supabase URLs kept as-is; legacy paths unchanged until migrated. */
export function canonicalMediaUrl(url: string, _apiBase?: string): string {
  if (!url?.trim()) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/uploads/')) return url;
  return url;
}
