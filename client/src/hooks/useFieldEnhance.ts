import { useCallback, useRef, useState } from 'react';
import { aiApi } from '@/lib/api';
import { FormSuggestionForm } from '@/lib/formSuggestionForms';
import { useWorkspace } from '@/hooks/useWorkspace';

interface UseFieldEnhanceOptions {
  form: FormSuggestionForm;
  tenantId?: string | null;
}

function newVariationSeed() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useFieldEnhance({ form, tenantId }: UseFieldEnhanceOptions) {
  const { activeWorkspace } = useWorkspace();
  const [enhancingKey, setEnhancingKey] = useState<string | null>(null);
  const recentByField = useRef<Record<string, string[]>>({});

  const enhanceField = useCallback(
    async (
      fieldKey: string,
      currentValue: string,
      onApply: (text: string) => void,
      trackKey?: string,
    ): Promise<boolean> => {
      if (!tenantId) return false;

      const key = trackKey ?? fieldKey;
      setEnhancingKey(key);
      try {
        const avoidTexts = recentByField.current[fieldKey]?.slice(-5) ?? [];
        const res = await aiApi.enhanceField({
          tenantId,
          workspaceId: activeWorkspace || undefined,
          form,
          fieldKey,
          currentValue: currentValue.trim() || undefined,
          variationSeed: newVariationSeed(),
          avoidTexts,
        });
        if (res.text) {
          onApply(res.text);
          const prev = recentByField.current[fieldKey] ?? [];
          recentByField.current[fieldKey] = [...prev, res.text].slice(-8);
        }
        return true;
      } catch {
        return false;
      } finally {
        setEnhancingKey(null);
      }
    },
    [tenantId, activeWorkspace, form],
  );

  return { enhanceField, enhancingKey, isEnhancing: enhancingKey !== null };
}
