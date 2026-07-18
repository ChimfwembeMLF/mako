import { useCallback, useState } from 'react';
import { aiApi } from '@/lib/api';
import { FormSuggestionForm } from '@/lib/formSuggestionForms';
import { useWorkspace } from '@/hooks/useWorkspace';

interface UseFieldEnhanceOptions {
  form: FormSuggestionForm;
  tenantId?: string | null;
}

export function useFieldEnhance({ form, tenantId }: UseFieldEnhanceOptions) {
  const { activeWorkspace } = useWorkspace();
  const [enhancingKey, setEnhancingKey] = useState<string | null>(null);

  const enhanceField = useCallback(
    async (
      fieldKey: string,
      currentValue: string,
      onApply: (text: string) => void,
      trackKey?: string,
    ): Promise<boolean> => {
      if (!tenantId) return false;

      setEnhancingKey(trackKey ?? fieldKey);
      try {
        const res = await aiApi.enhanceField({
          tenantId,
          workspaceId: activeWorkspace || undefined,
          form,
          fieldKey,
          currentValue: currentValue.trim() || undefined,
        });
        if (res.text) onApply(res.text);
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
