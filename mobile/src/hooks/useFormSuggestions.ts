import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import {
  FORM_SUGGESTION_FIELDS,
  FormSuggestionForm,
  ROTATION_INTERVAL_MS,
} from '../constants/formSuggestionForms';
import { useWorkspace } from '../context/WorkspaceContext';

const PAUSE_MS = 60_000;

export type SuggestionMap = Record<string, string[]>;

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
    (opts?: { refresh?: boolean }) => {
      if (!tenantId || fieldKeys.length === 0) return Promise.resolve();

      setLoading(true);
      const avoidTexts = opts?.refresh
        ? Object.values(suggestionsRef.current)
            .flat()
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(-20)
        : undefined;

      return api
        .getFormSuggestions({
          tenantId,
          workspaceId: activeWorkspace?.id,
          form,
          fields: FORM_SUGGESTION_FIELDS[form],
          variationSeed: newVariationSeed(),
          refresh: opts?.refresh,
          avoidTexts,
        })
        .then((res) => {
          const next = res.suggestions ?? {};
          setSuggestions(next);
          setSelectedIndex({});
        })
        .catch(() => {
          setSuggestions({});
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [tenantId, form, fieldKeys.length, activeWorkspace?.id],
  );

  const fetchSuggestions = useCallback(() => {
    void loadFromApi();
  }, [loadFromApi]);

  const refreshSuggestions = useCallback(() => {
    return loadFromApi({ refresh: true });
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

    const id = setInterval(tick, ROTATION_INTERVAL_MS);
    return () => clearInterval(id);
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
