import { PLATFORMS, platformOf } from '@/lib/platforms';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';

interface PlatformPickerCarouselProps {
  values: string[];
  onChange: (values: string[]) => void;
  className?: string;
}

export function PlatformPickerCarousel({ values, onChange, className }: PlatformPickerCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();

  useEffect(() => {
    if (!api) return;
    api.reInit();
  }, [api, values.length]);

  function toggle(value: string) {
    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value));
    } else {
      onChange([...values, value]);
    }
  }

  return (
    <div className={className}>
      <Carousel setApi={setApi} opts={{ align: 'start', dragFree: true }}>
        <CarouselContent className="-ml-2">
          {PLATFORMS.map((p) => {
            const active = values.includes(p.value);
            const Icon = p.icon;
            return (
              <CarouselItem key={p.value} className="pl-2 basis-[42%] sm:basis-[32%] md:basis-[24%]">
                <button
                  type="button"
                  onClick={() => toggle(p.value)}
                  className={cn(
                    'w-full rounded-xl border-2 p-3 text-left transition-all',
                    active
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border bg-card hover:border-primary/30 hover:bg-muted/30',
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${p.color}18` }}
                    >
                      <Icon className="h-4 w-4" style={{ color: p.color }} />
                    </div>
                    {active && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold leading-tight">{p.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                    {p.maxChars.toLocaleString()} chars · {p.media.maxAttachments} max media
                  </p>
                </button>
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>
      {values.length > 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          {values.length} selected: {values.map((v) => platformOf(v).label).join(', ')}
        </p>
      )}
    </div>
  );
}
