/** Strip HTML tags and decode common entities. */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"');
}

/** Remove markdown emphasis/links while keeping readable text. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '');
}

/** HTML → plain text optimized for a social platform API (links, spacing). */
export function htmlToPublishPlainText(
  html: string,
  platform?: string,
): string {
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

export function formatPlainPostText(text: string): string {
  let plain = text ?? '';
  if (/<[a-z][\s\S]*>/i.test(plain)) {
    plain = htmlToPublishPlainText(plain);
  }
  return plain
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatContentForPlatform(
  platform: string,
  raw: string,
): string {
  const plain = formatPlainPostText(raw);
  if (!plain) return '';

  const key = platform.toLowerCase();

  if (key === 'instagram') {
    const sentences = splitSentences(plain);
    if (sentences.length <= 2) {
      return appendInstagramHashtags(plain);
    }
    const hook = sentences.slice(0, 2).join(' ');
    const body = sentences.slice(2).join(' ');
    const core = `${hook}\n\n${body}`.trim();
    return appendInstagramHashtags(core);
  }

  if (key === 'facebook') {
    const sentences = splitSentences(plain);
    if (sentences.length <= 2) return plain;
    const paragraphs: string[] = [];
    for (let i = 0; i < sentences.length; i += 2) {
      paragraphs.push(sentences.slice(i, i + 2).join(' '));
    }
    return paragraphs.join('\n\n');
  }

  if (key === 'linkedin') {
    const sentences = splitSentences(plain);
    return sentences.join('\n\n');
  }

  if (key === 'twitter' || key === 'x') {
    return plain.length > 280 ? `${plain.slice(0, 277).trimEnd()}…` : plain;
  }

  return plain;
}

function appendInstagramHashtags(text: string): string {
  if (/#\w+/.test(text)) return text;
  return `${text}\n\n#Mako #Marketing #AI #SocialMedia #ContentCreation`.trim();
}

export function payloadsAreDuplicates(
  platforms: string[],
  payloads: Record<string, { content?: string } | undefined>,
): boolean {
  const normalized = platforms
    .map((p) => formatPlainPostText(payloads[p]?.content ?? ''))
    .filter(Boolean);
  if (normalized.length < 2) return false;
  const first = normalized[0];
  return normalized.every((c) => c === first);
}

export function contentNeedsFormatting(text: string): boolean {
  const raw = text ?? '';
  return /[*_`#]/.test(raw) || /<[^>]+>/.test(raw);
}
