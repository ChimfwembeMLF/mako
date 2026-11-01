import * as cheerio from 'cheerio';

const MAX_PAGE_TEXT = 12000;
/** Below this, the page is probably an empty shell that JavaScript fills in. */
const MIN_READABLE_BODY = 200;
const MAX_DEPTH = 12;

/** App state that says nothing about the brand. */
const SKIPPED_ROOT_KEYS = new Set([
  'auth',
  'csrf',
  'csrf_token',
  'errorBags',
  'errors',
  'flash',
  'jetstream',
  'session',
  'ziggy',
]);
const SKIPPED_KEY =
  /url|image|path|slug|token|csrf|icon|href|src|isbn|logo|uuid|hash|_at$|Id$|_id$|^id$/i;
const LABEL_KEY = /name|title|label|heading|brand|company|tagline|phone|email|address/i;

function readableValue(key: string, value: string): string | null {
  const text = value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!/[a-z]/i.test(text) || SKIPPED_KEY.test(key)) return null;
  // Single words are usually codes or enum values unless the key says otherwise.
  return text.includes(' ') || LABEL_KEY.test(key) ? text : null;
}

function collectStrings(
  value: unknown,
  key: string,
  depth: number,
  lines: Set<string>,
): void {
  if (depth > MAX_DEPTH || value === null || value === undefined) return;
  if (typeof value === 'string') {
    const text = readableValue(key, value);
    if (text) lines.add(`${key}: ${text}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, key, depth + 1, lines));
    return;
  }
  if (typeof value === 'object') {
    for (const [childKey, child] of Object.entries(value)) {
      if (depth === 0 && SKIPPED_ROOT_KEYS.has(childKey)) continue;
      collectStrings(child, childKey, depth + 1, lines);
    }
  }
}

function embeddedText(
  json: string | undefined,
  lines: Set<string>,
  field?: string,
): void {
  if (!json) return;
  try {
    const data = JSON.parse(json);
    collectStrings(field ? data[field] : data, '', 0, lines);
  } catch {
    // Not valid JSON; the rest of the page may still be readable.
  }
}

/**
 * Readable text for a page. Sites built with Inertia or Next.js send an empty
 * body and put their content in the HTML as data for the browser app, so when
 * the body is nearly empty, read that data and the page's metadata instead.
 */
export function extractPageText(html: string): { title: string; text: string } {
  const $ = cheerio.load(html);
  const title = $('title').text().trim();

  const lines = new Set<string>();
  for (const name of ['description', 'og:title', 'og:description', 'og:site_name']) {
    const content = $(`meta[name="${name}"], meta[property="${name}"]`)
      .attr('content')
      ?.trim();
    if (content) lines.add(`${name.replace('og:', '')}: ${content}`);
  }
  $('script[type="application/ld+json"]').each((_, el) => {
    embeddedText($(el).html() ?? undefined, lines);
  });
  embeddedText($('[data-page]').first().attr('data-page'), lines, 'props');
  embeddedText($('script#__NEXT_DATA__').html() ?? undefined, lines);

  $('script, style, nav, footer, noscript, iframe').remove();
  const body = $('main, article, [role=main], .content, #content, body')
    .first()
    .text()
    .replace(/\s+/g, ' ')
    .trim();

  const text =
    body.length >= MIN_READABLE_BODY
      ? body
      : [body, ...lines].filter(Boolean).join('\n');
  return { title, text: text.slice(0, MAX_PAGE_TEXT) };
}
