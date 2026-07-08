import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { SuggestionCarousel } from './SuggestionCarousel';

interface SuggestedFieldProps {
  id?: string;
  type: 'input' | 'textarea';
  value: string;
  onChange: (value: string) => void;
  fallbackPlaceholder?: string;
  placeholder: string;
  suggestions?: string[];
  selectedIndex?: number;
  onSelectIndex?: (index: number) => void;
  onPauseRotation?: () => void;
  isLive?: boolean;
  rows?: number;
  className?: string;
}

export function SuggestedField({
  id,
  type,
  value,
  onChange,
  fallbackPlaceholder,
  placeholder,
  suggestions = [],
  selectedIndex = 0,
  onSelectIndex,
  onPauseRotation,
  isLive,
  rows = 4,
  className,
}: SuggestedFieldProps) {
  const showCarousel = !value.trim() && suggestions.length > 0;

  return (
    <div className="space-y-2">
      {type === 'input' ? (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onPauseRotation}
          placeholder={placeholder || fallbackPlaceholder}
          className={cn(
            isLive && !value.trim() && 'placeholder:text-primary/70 placeholder:transition-opacity',
            className,
          )}
        />
      ) : (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onPauseRotation}
          placeholder={placeholder || fallbackPlaceholder}
          rows={rows}
          className={cn(
            isLive && !value.trim() && 'placeholder:text-primary/70 placeholder:transition-opacity',
            className,
          )}
        />
      )}

      {showCarousel && onSelectIndex && (
        <SuggestionCarousel
          suggestions={suggestions}
          selectedIndex={selectedIndex}
          onSelectIndex={onSelectIndex}
          onApply={onChange}
          onInteract={onPauseRotation}
          isLive={isLive}
        />
      )}
    </div>
  );
}
