import { Loader2, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface SuggestedFieldProps {
  id?: string;
  type: 'input' | 'textarea';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onEnhance?: () => void | Promise<void>;
  enhancing?: boolean;
  rows?: number;
  className?: string;
}

export function SuggestedField({
  id,
  type,
  value,
  onChange,
  placeholder,
  onEnhance,
  enhancing = false,
  rows = 4,
  className,
}: SuggestedFieldProps) {
  const hasText = value.trim().length > 0;
  const enhanceLabel = hasText ? 'Enhance with AI' : 'Generate with AI';

  return (
    <div className="relative group">
      {type === 'input' ? (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(onEnhance && 'pr-10', className)}
        />
      ) : (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={cn(onEnhance && 'pr-12', className)}
        />
      )}

      {onEnhance && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={enhancing}
                onClick={() => void onEnhance()}
                className={cn(
                  'absolute right-1.5 h-8 w-8 text-primary hover:text-primary hover:bg-primary/10',
                  type === 'textarea' ? 'top-1.5' : 'top-1/2 -translate-y-1/2',
                )}
                aria-label={enhanceLabel}
              >
                {enhancing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">
              {enhanceLabel}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
