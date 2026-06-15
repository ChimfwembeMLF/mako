import type { FormSuggestionForm } from '@/lib/formSuggestionForms';
import { CACHE_TTL_MS, CACHE_VERSION } from '@/lib/formSuggestionForms';

export type SuggestionMap = Record<string, string[]>;

function cacheKey(tenantId: string, form: FormSuggestionForm) {
  return `form-suggestions:${CACHE_VERSION}:${tenantId}:${form}`;
}

export function readSuggestionCache(
  tenantId: string,
  form: FormSuggestionForm,
): SuggestionMap | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(tenantId, form));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; suggestions: SuggestionMap };
    if (Date.now() - parsed.at > CACHE_TTL_MS) {
      sessionStorage.removeItem(cacheKey(tenantId, form));
      return null;
    }
    return parsed.suggestions;
  } catch {
    return null;
  }
}

export function writeSuggestionCache(
  tenantId: string,
  form: FormSuggestionForm,
  suggestions: SuggestionMap,
) {
  try {
    sessionStorage.setItem(
      cacheKey(tenantId, form),
      JSON.stringify({ at: Date.now(), suggestions }),
    );
  } catch {
    /* quota or private mode */
  }
}
