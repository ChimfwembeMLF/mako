import type { FormSuggestionForm } from '@/lib/formSuggestionForms';
import { CACHE_TTL_MS, CACHE_VERSION } from '@/lib/formSuggestionForms';

export type SuggestionMap = Record<string, string[]>;

function cacheKey(tenantId: string, form: FormSuggestionForm, workspaceId?: string | null) {
  const wsPart = workspaceId ? `:${workspaceId}` : '';
  return `form-suggestions:${CACHE_VERSION}:${tenantId}${wsPart}:${form}`;
}

export function readSuggestionCache(
  tenantId: string,
  form: FormSuggestionForm,
  workspaceId?: string | null,
): SuggestionMap | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(tenantId, form, workspaceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; suggestions: SuggestionMap };
    if (Date.now() - parsed.at > CACHE_TTL_MS) {
      sessionStorage.removeItem(cacheKey(tenantId, form, workspaceId));
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
  workspaceId?: string | null,
) {
  try {
    sessionStorage.setItem(
      cacheKey(tenantId, form, workspaceId),
      JSON.stringify({ at: Date.now(), suggestions }),
    );
  } catch {
    /* quota or private mode */
  }
}
