/** Rich text helpers — store HTML in the app; convert to plain text for social APIs. */

export function isHtmlContent(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text ?? '');
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Normalize stored value to HTML for editors/previews. */
export function normalizeRichContent(text: string): string {
  const raw = (text ?? '').trim();
  if (!raw) return '';
  if (isHtmlContent(raw)) return raw;
  return plainToHtml(raw);
}

/** Plain text or newlines → safe HTML paragraphs. */
export function plainToHtml(text: string): string {
  const raw = (text ?? '').trim();
  if (!raw) return '';
  if (isHtmlContent(raw)) return raw;
  return raw
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** HTML → plain text (for char counts & previews of published API copy). */
export function htmlToPlainText(html: string): string {
  let text = (html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n');

  text = text.replace(
    /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, url: string, label: string) => {
      const t = label.replace(/<[^>]*>/g, '').trim();
      return t && t !== url ? `${t} (${url})` : url;
    },
  );

  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

/** HTML → plain text optimized for a social platform API (links, spacing). */
export function htmlToPublishPlainText(html: string, platform?: string): string {
  let text = (html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n');

  const key = platform?.toLowerCase() ?? '';

  text = text.replace(
    /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, url: string, label: string) => {
      const t = label.replace(/<[^>]*>/g, '').trim();
      if (key === 'instagram') return t ? `${t}\n${url}` : url;
      return t ? `${t} ${url}` : url;
    },
  );

  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function plainTextLength(htmlOrText: string): number {
  return htmlToPlainText(htmlOrText).length;
}
