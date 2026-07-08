import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function previewLine(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1)}…`;
}

interface SuggestionCarouselProps {
  suggestions: string[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onApply: (text: string) => void;
  onInteract?: () => void;
  isLive?: boolean;
  className?: string;
}

export function SuggestionCarousel({
  suggestions,
  selectedIndex,
  onSelectIndex,
  onApply,
  onInteract,
  isLive,
  className,
}: SuggestionCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();

  useEffect(() => {
    if (!api) return;
    api.scrollTo(selectedIndex, true);
  }, [api, selectedIndex]);

  const handleSelect = useCallback(
    (index: number) => {
      onInteract?.();
      onSelectIndex(index);
      api?.scrollTo(index);
    },
    [api, onInteract, onSelectIndex],
  );

  useEffect(() => {
    if (!api) return;
    const onChange = () => {
      const idx = api.selectedScrollSnap();
      if (idx !== selectedIndex) {
        onInteract?.();
        onSelectIndex(idx);
      }
    };
    api.on('select', onChange);
    return () => {
      api.off('select', onChange);
    };
  }, [api, onInteract, onSelectIndex, selectedIndex]);

  if (suggestions.length === 0) return null;

  return (
    <div
      className={cn('rounded-lg border bg-muted/20 overflow-hidden', className)}
      onMouseEnter={onInteract}
      onFocusCapture={onInteract}
    >
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b bg-muted/30">
        <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" />
          AI suggestions
          {isLive && (
            <span className="text-primary normal-case tracking-normal font-normal">· live</span>
          )}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {selectedIndex + 1} / {suggestions.length}
        </span>
      </div>

      <div className="relative px-1 py-2">
        <Carousel
          setApi={setApi}
          opts={{ align: 'start', loop: suggestions.length > 1 }}
          className="w-full"
        >
          <CarouselContent className="-ml-2">
            {suggestions.map((text, index) => (
              <CarouselItem key={index} className="pl-2 basis-full">
                <button
                  type="button"
                  onClick={() => onApply(text)}
                  className={cn(
                    'w-full text-left rounded-md border px-3 py-2 transition-colors',
                    'hover:border-primary/40 hover:bg-primary/5',
                    index === selectedIndex
                      ? 'border-primary/30 bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border/60 bg-background/80',
                  )}
                >
                  <p className="text-xs text-foreground whitespace-pre-wrap line-clamp-4 leading-relaxed">
                    {text}
                  </p>
                  <p className="text-[10px] text-primary mt-1.5">Click to use</p>
                </button>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {suggestions.length > 1 && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-background/90 shadow-sm border"
              onClick={() => {
                onInteract?.();
                api?.scrollPrev();
              }}
              aria-label="Previous suggestion"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-background/90 shadow-sm border"
              onClick={() => {
                onInteract?.();
                api?.scrollNext();
              }}
              aria-label="Next suggestion"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {suggestions.length > 1 && (
        <div className="flex items-center gap-1.5 px-2.5 pb-2">
          {suggestions.map((text, index) => (
            <button
              key={index}
              type="button"
              title={previewLine(text, 80)}
              onClick={() => handleSelect(index)}
              className={cn(
                'group flex-1 min-w-0 rounded-md border px-1.5 py-1 text-left transition-colors',
                index === selectedIndex
                  ? 'border-primary/40 bg-primary/10'
                  : 'border-transparent bg-muted/40 hover:bg-muted/70',
              )}
            >
              <span
                className={cn(
                  'block h-1 rounded-full mb-1',
                  index === selectedIndex ? 'bg-primary' : 'bg-muted-foreground/30',
                )}
              />
              <span className="block text-[9px] text-muted-foreground truncate leading-tight">
                {previewLine(text, 28)}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="px-2.5 pb-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full h-7 text-xs"
          onClick={() => onApply(suggestions[selectedIndex]!)}
        >
          <Sparkles className="h-3 w-3 mr-1.5" />
          Use suggestion {selectedIndex + 1}
        </Button>
      </div>
    </div>
  );
}
