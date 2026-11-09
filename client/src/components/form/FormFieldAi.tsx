import { useEffect, useState } from 'react';
import { RefreshCw, Sparkles, Undo2 } from 'lucide-react';
import { SuggestedField } from '@/components/form/SuggestedField';
import { useFieldEnhance } from '@/hooks/useFieldEnhance';
import { useFormSuggestions } from '@/hooks/useFormSuggestions';
import { useToast } from '@/hooks/use-toast';
import type { FormSuggestionForm } from '@/lib/formSuggestionForms';
import { cn } from '@/lib/utils';
import { cleanIdea } from '@/lib/clean-idea';

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

/** How many idea chips to show under an empty field. */
const IDEAS_SHOWN = 3;

function oneLine(text: string, max = 70): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

/**
 * A text field with AI help: a button in the field writes or improves the text, and an
 * empty field offers a few ideas to start from. Anything AI writes can be undone.
 */
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
  const { toast } = useToast();
  const { enhanceField, enhancingKey } = useFieldEnhance({ form, tenantId });
  const { loading: ideasLoading, fetchSuggestions, refreshSuggestions, getSuggestionsForField, pauseField } =
    useFormSuggestions({
      form,
      tenantId,
      fieldKeys: [fieldKey],
      values: { [fieldKey]: value },
      enabled: Boolean(tenantId),
    });

  /** The text before AI last changed it, so it can be put back. Cleared once you type. */
  const [undoValue, setUndoValue] = useState<string | null>(null);
  const [aiValue, setAiValue] = useState<string | null>(null);

  useEffect(() => {
    if (tenantId) void fetchSuggestions();
  }, [tenantId, form, fetchSuggestions]);

  // Typing after an AI change keeps your edit and drops the undo.
  useEffect(() => {
    if (aiValue !== null && value !== aiValue) {
      setUndoValue(null);
      setAiValue(null);
    }
  }, [value, aiValue]);

  const applyFromAi = (text: string) => {
    setUndoValue(value);
    setAiValue(text);
    onChange(text);
  };

  const ideas = getSuggestionsForField(fieldKey)
    .map(cleanIdea)
    .filter(Boolean)
    .slice(0, IDEAS_SHOWN);
  const enhancing = enhancingKey === fieldKey;

  return (
    <div className="space-y-2">
      <SuggestedField
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={className}
        rows={rows}
        enhancing={enhancing}
        onEnhance={
          tenantId
            ? async () => {
                const ok = await enhanceField(fieldKey, value, applyFromAi, fieldKey);
                if (!ok) {
                  toast({
                    title: "AI couldn't write this right now",
                    description: 'Try again in a moment, or write it yourself.',
                    variant: 'destructive',
                  });
                }
              }
            : undefined
        }
      />

      {undoValue !== null && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>Written by AI. Check it reads right.</span>
          <button
            type="button"
            onClick={() => {
              onChange(undoValue);
              setUndoValue(null);
              setAiValue(null);
            }}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Undo2 className="h-3 w-3" /> Undo
          </button>
        </div>
      )}

      {!value.trim() && ideas.length > 0 && (
        // contain: inline-size stops a long idea from widening the form around it.
        <div className="flex flex-wrap items-center gap-1.5 [contain:inline-size]" onMouseEnter={() => pauseField(fieldKey)}>
          <span className="mr-0.5 text-[11px] font-medium text-muted-foreground">Ideas</span>
          {ideas.map((idea, i) => (
            <button
              key={`${i}-${idea.slice(0, 12)}`}
              type="button"
              title={idea}
              onClick={() => {
                pauseField(fieldKey);
                applyFromAi(idea);
              }}
              className={cn(
                'max-w-full truncate rounded-full border border-border bg-card px-3 py-1 text-left text-xs text-foreground/80 transition-colors',
                'hover:border-primary/50 hover:bg-primary/5 hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              {oneLine(idea)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void refreshSuggestions()}
            disabled={ideasLoading}
            aria-label="Show other ideas"
            title="Show other ideas"
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', ideasLoading && 'animate-spin')} />
          </button>
        </div>
      )}
    </div>
  );
}
