import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { aiApi } from '@/lib/api';
import {
  clearSuggestionCache,
  readSuggestionCache,
  writeSuggestionCache,
  type SuggestionMap,
} from '@/lib/formSuggestionCache';
import {
  FORM_SUGGESTION_FIELDS,
  FormSuggestionForm,
  ROTATION_INTERVAL_MS,
} from '@/lib/formSuggestionForms';

import { useWorkspace } from '@/hooks/useWorkspace';

const PAUSE_MS = 60_000;

function newVariationSeed() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

interface UseFormSuggestionsOptions {
  form: FormSuggestionForm;
  tenantId?: string | null;
  fieldKeys: string[];
  values: Record<string, string>;
  enabled?: boolean;
}

export function useFormSuggestions({
  form,
  tenantId,
  fieldKeys,
  values,
  enabled = true,
}: UseFormSuggestionsOptions) {
  const { activeWorkspace } = useWorkspace();
  const [suggestions, setSuggestions] = useState<SuggestionMap>({});
  const [selectedIndex, setSelectedIndex] = useState<Record<string, number>>({});
  const [activeFieldKey, setActiveFieldKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const rotationRef = useRef(0);
  const pausedUntilRef = useRef<Record<string, number>>({});
  const suggestionsRef = useRef<SuggestionMap>({});

  useEffect(() => {
    suggestionsRef.current = suggestions;
  }, [suggestions]);

  const emptyFieldKeys = useMemo(
    () => fieldKeys.filter((key) => !values[key]?.trim()),
    [fieldKeys, values],
  );

  const loadFromApi = useCallback(
    (opts?: { refresh?: boolean; useCache?: boolean }) => {
      if (!tenantId || fieldKeys.length === 0) return Promise.resolve();

      if (opts?.useCache !== false && !opts?.refresh) {
        const cached = readSuggestionCache(tenantId, form, activeWorkspace);
        if (cached) {
          setSuggestions(cached);
          return Promise.resolve();
        }
      } else if (opts?.refresh) {
        clearSuggestionCache(tenantId, form, activeWorkspace);
      }

      setLoading(true);
      const avoidTexts = opts?.refresh
        ? Object.values(suggestionsRef.current)
            .flat()
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(-20)
        : undefined;

      return aiApi
        .getFormSuggestions({
          tenantId,
          workspaceId: activeWorkspace || undefined,
          form,
          fields: FORM_SUGGESTION_FIELDS[form],
          variationSeed: newVariationSeed(),
          refresh: opts?.refresh,
          avoidTexts,
        })
        .then((res) => {
          const next = res.suggestions ?? {};
          setSuggestions(next);
          writeSuggestionCache(tenantId, form, next, activeWorkspace);
          setSelectedIndex({});
        })
        .catch(() => {
          setSuggestions({});
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [tenantId, form, fieldKeys.length, activeWorkspace],
  );

  const fetchSuggestions = useCallback(() => {
    void loadFromApi({ useCache: true });
  }, [loadFromApi]);

  const refreshSuggestions = useCallback(() => {
    return loadFromApi({ refresh: true, useCache: false });
  }, [loadFromApi]);

  const isFieldPaused = useCallback((fieldKey: string) => {
    const until = pausedUntilRef.current[fieldKey] ?? 0;
    return Date.now() < until;
  }, []);

  const pauseField = useCallback((fieldKey: string) => {
    pausedUntilRef.current[fieldKey] = Date.now() + PAUSE_MS;
  }, []);

  useEffect(() => {
    if (!enabled || emptyFieldKeys.length === 0) {
      setActiveFieldKey(null);
      return;
    }

    const tick = () => {
      const keys = fieldKeys.filter((key) => !values[key]?.trim());
      if (keys.length === 0) return;

      let attempts = 0;
      let key = keys[rotationRef.current % keys.length];
      while (isFieldPaused(key) && attempts < keys.length) {
        rotationRef.current += 1;
        key = keys[rotationRef.current % keys.length];
        attempts += 1;
      }
      if (isFieldPaused(key)) return;

      rotationRef.current += 1;
      setActiveFieldKey(key);

      setSelectedIndex((prev) => {
        const list = suggestions[key];
        const max = list?.length ? list.length : 1;
        return { ...prev, [key]: ((prev[key] ?? 0) + 1) % max };
      });
    };

    const id = window.setInterval(tick, ROTATION_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [enabled, fieldKeys, values, suggestions, emptyFieldKeys.length, isFieldPaused]);

  const getSuggestionsForField = useCallback(
    (fieldKey: string): string[] => {
      if (values[fieldKey]?.trim()) return [];
      return suggestions[fieldKey] ?? [];
    },
    [suggestions, values],
  );

  const getSelectedIndex = useCallback(
    (fieldKey: string) => selectedIndex[fieldKey] ?? 0,
    [selectedIndex],
  );

  const setFieldIndex = useCallback(
    (fieldKey: string, index: number) => {
      pauseField(fieldKey);
      setSelectedIndex((prev) => ({ ...prev, [fieldKey]: index }));
    },
    [pauseField],
  );

  const getPlaceholder = useCallback(
    (fieldKey: string, fallback: string) => {
      if (values[fieldKey]?.trim()) return fallback;
      const list = suggestions[fieldKey];
      if (!list?.length) return fallback;
      const index = selectedIndex[fieldKey] ?? 0;
      const text = list[index % list.length];
      if (!text) return fallback;
      const oneLine = text.replace(/\s+/g, ' ').trim();
      return oneLine.length > 90 ? `${oneLine.slice(0, 89)}…` : oneLine;
    },
    [suggestions, selectedIndex, values],
  );

  const isFieldActive = useCallback(
    (fieldKey: string) => activeFieldKey === fieldKey && !values[fieldKey]?.trim(),
    [activeFieldKey, values],
  );

  return {
    loading,
    getPlaceholder,
    getSuggestionsForField,
    getSelectedIndex,
    setFieldIndex,
    pauseField,
    isFieldActive,
    activeFieldKey,
    fetchSuggestions,
    refreshSuggestions,
  };
}
