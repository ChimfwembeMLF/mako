/** "Jo Banda" <jo@x.com> → Jo Banda. Nothing when From is just an address. */
export function displayName(from: string | null | undefined): string | undefined {
  const m = /^\s*"?([^"<]*?)"?\s*<[^>]+>\s*$/.exec(from ?? '');
  const name = m?.[1]?.trim();
  return name && !name.includes('@') ? name : undefined;
}
