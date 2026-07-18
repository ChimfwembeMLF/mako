import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { SuggestedField } from '@/components/form/SuggestedField';
import { SuggestionCarousel } from '@/components/form/SuggestionCarousel';
import { Button } from '@/components/ui/button';
import { useFieldEnhance } from '@/hooks/useFieldEnhance';
import { useFormSuggestions } from '@/hooks/useFormSuggestions';
import type { FormSuggestionForm } from '@/lib/formSuggestionForms';

type Props = {
  id?: string;
  form: FormSuggestionForm;
  tenantId?: string | null;
  fieldKey: string;
  type: 'input' | 'textarea';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
};

export function FormFieldAi({
  id,
  form,
  tenantId,
  fieldKey,
  type,
  value,
  onChange,
  placeholder,
  rows,
  className,
}: Props) {
  const { enhanceField, enhancingKey } = useFieldEnhance({ form, tenantId });
  const {
    loading: suggestionsLoading,
    fetchSuggestions,
    refreshSuggestions,
    getSuggestionsForField,
    getSelectedIndex,
    setFieldIndex,
    pauseField,
    isFieldActive,
    getPlaceholder,
  } = useFormSuggestions({
    form,
    tenantId,
    fieldKeys: [fieldKey],
    values: { [fieldKey]: value },
    enabled: Boolean(tenantId),
  });

  useEffect(() => {
    if (tenantId) void fetchSuggestions();
  }, [tenantId, form, fetchSuggestions]);

  const suggestions = getSuggestionsForField(fieldKey);
  const resolvedPlaceholder = getPlaceholder(fieldKey, placeholder ?? '');

  return (
    <div className="space-y-2">
      <SuggestedField
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={resolvedPlaceholder}
        className={className}
        rows={rows}
        onEnhance={() =>
          enhanceField(fieldKey, value, onChange, fieldKey)
        }
        enhancing={enhancingKey === fieldKey}
      />

      {!value.trim() && suggestions.length > 0 && (
        <div className="space-y-1.5">
          <SuggestionCarousel
            suggestions={suggestions}
            selectedIndex={getSelectedIndex(fieldKey)}
            onSelectIndex={(index) => setFieldIndex(fieldKey, index)}
            onApply={(text) => {
              pauseField(fieldKey);
              onChange(text);
            }}
            onInteract={() => pauseField(fieldKey)}
            isLive={isFieldActive(fieldKey)}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground w-full"
            disabled={suggestionsLoading}
            onClick={() => void refreshSuggestions()}
          >
            <RefreshCw className={`h-3 w-3 mr-1.5 ${suggestionsLoading ? 'animate-spin' : ''}`} />
            New suggestions
          </Button>
        </div>
      )}
    </div>
  );
}
