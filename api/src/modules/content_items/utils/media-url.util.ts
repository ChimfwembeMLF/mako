/** Public media URLs are used as-is. */
export function resolvePublicMediaUrl(
  url: string,
  _apiPublicBase?: string,
): string {
  if (!url?.trim()) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return url;
}

/** Normalize stored media URLs; absolute URLs and /uploads/ paths are kept as-is. */
export function canonicalMediaUrl(url: string, _apiBase?: string): string {
  if (!url?.trim()) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/uploads/')) return url;
  return url;
}
