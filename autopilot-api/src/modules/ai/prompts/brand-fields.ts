/** JSON keys returned by brand extraction (matches client BrandData). */
export const BRAND_FIELD_KEYS = [
  'companyName',
  'industry',
  'description',
  'services',
  'targetAudience',
  'audiencePainPoints',
  'toneOfVoice',
  'brandPersonality',
  'currentOffers',
  'uniqueSellingPoints',
  'faqs',
  'caseStudies',
  'bannedWords',
  'bannedTopics',
  'competitors',
  'keywords',
] as const;

export type BrandFieldKey = (typeof BRAND_FIELD_KEYS)[number];

export interface BrandContext {
  companyName?: string;
  industry?: string;
  description?: string;
  services?: string;
  targetAudience?: string;
  audiencePainPoints?: string;
  toneOfVoice?: string;
  brandPersonality?: string;
  currentOffers?: string;
  uniqueSellingPoints?: string;
  faqs?: string;
  caseStudies?: string;
  bannedWords?: string;
  bannedTopics?: string;
  competitors?: string;
  keywords?: string;
}

/** Maps snake_case / alternate keys from LLM output to canonical camelCase keys. */
const FIELD_ALIASES: Record<string, BrandFieldKey> = {
  companyname: 'companyName',
  company_name: 'companyName',
  targetaudience: 'targetAudience',
  target_audience: 'targetAudience',
  audiencepainpoints: 'audiencePainPoints',
  audience_pain_points: 'audiencePainPoints',
  pain_points: 'audiencePainPoints',
  toneofvoice: 'toneOfVoice',
  tone_of_voice: 'toneOfVoice',
  brandpersonality: 'brandPersonality',
  brand_personality: 'brandPersonality',
  currentoffers: 'currentOffers',
  current_offers: 'currentOffers',
  offers: 'currentOffers',
  uniquesellingpoints: 'uniqueSellingPoints',
  unique_selling_points: 'uniqueSellingPoints',
  usp: 'uniqueSellingPoints',
  usps: 'uniqueSellingPoints',
  casestudies: 'caseStudies',
  case_studies: 'caseStudies',
  bannedwords: 'bannedWords',
  banned_words: 'bannedWords',
  bannedtopics: 'bannedTopics',
  banned_topics: 'bannedTopics',
  key_phrases: 'keywords',
  keyphrases: 'keywords',
};

function toFieldKey(rawKey: string): BrandFieldKey | null {
  if ((BRAND_FIELD_KEYS as readonly string[]).includes(rawKey)) {
    return rawKey as BrandFieldKey;
  }
  const normalized = rawKey.replace(/\s+/g, '_').toLowerCase();
  if (FIELD_ALIASES[normalized]) return FIELD_ALIASES[normalized];
  if (FIELD_ALIASES[rawKey]) return FIELD_ALIASES[rawKey];
  return null;
}

function coerceToString(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) {
    return val
      .map((item) => coerceToString(item))
      .filter(Boolean)
      .join('\n');
  }
  if (typeof val === 'object') {
    return Object.entries(val as Record<string, unknown>)
      .map(([k, v]) => {
        const inner = coerceToString(v);
        return inner ? `${k}: ${inner}` : '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function flattenPayload(raw: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = { ...raw };
  for (const nestKey of ['brand', 'profile', 'data', 'fields']) {
    const nested = raw[nestKey];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      Object.assign(flat, nested as Record<string, unknown>);
    }
  }
  return flat;
}

/** Normalizes messy LLM JSON into canonical brand profile string fields. */
export function normalizeBrandExtraction(
  raw: unknown,
): Partial<Record<BrandFieldKey, string>> {
  if (!raw || typeof raw !== 'object') return {};

  const flat = flattenPayload(raw as Record<string, unknown>);
  const result: Partial<Record<BrandFieldKey, string>> = {};

  for (const [key, val] of Object.entries(flat)) {
    const fieldKey = toFieldKey(key);
    if (!fieldKey) continue;
    const str = coerceToString(val);
    if (!str) continue;
    if (!result[fieldKey] || str.length > result[fieldKey]!.length) {
      result[fieldKey] = str;
    }
  }

  return result;
}

export function brandExtractionSystemPrompt(): string {
  return `You extract structured brand profile fields from website or document text.
Return ONLY valid JSON with these keys (camelCase exactly): ${BRAND_FIELD_KEYS.join(
    ', ',
  )}.

Rules:
- Include ALL keys in your JSON response.
- Populate every field you can from the content. Do not omit keys.
- When a field is not explicitly stated, infer a reasonable value from context (tone, industry, offerings, copy style).
- toneOfVoice & brandPersonality: infer from how the site writes (formal, friendly, bold, etc.).
- targetAudience & audiencePainPoints: infer who the business serves and their problems.
- keywords: recurring phrases, taglines, and industry terms from the site.
- competitors: name similar businesses if mentioned; otherwise note "Not specified on website".
- faqs: extract Q&A from the site or draft 2-3 likely FAQs for this business.
- caseStudies: testimonials, success stories, or client logos described on the site.
- currentOffers: promotions, CTAs, or primary offers visible on the site.
- bannedWords & bannedTopics: suggest sensible guardrails for this brand/industry.
- Use plain text; use newlines to separate list items.
- Keep values concise but useful (1-5 sentences or a short list).`;
}

export function brandContextBlock(brand: BrandContext): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(brand)) {
    if (value?.trim()) lines.push(`${key}: ${value.trim()}`);
  }
  return lines.length ? lines.join('\n') : 'No brand profile configured yet.';
}
