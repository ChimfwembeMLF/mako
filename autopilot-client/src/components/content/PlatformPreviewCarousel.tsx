import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buildPlatformPayloads, platformOf, PlatformPayload } from '@/lib/platforms';
import { PlatformPreview } from './PlatformPreview';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';

interface PlatformPreviewCarouselProps {
  platforms: string[];
  platformPayloads?: Record<string, PlatformPayload>;
  title?: string;
  baseContent?: string;
  mediaUrls?: string[];
  onEditPayload?: (platform: string, patch: Partial<PlatformPayload>) => void;
  editable?: boolean;
  className?: string;
}

export function PlatformPreviewCarousel({
  platforms,
  platformPayloads = {},
  title = '',
  baseContent = '',
  mediaUrls = [],
  onEditPayload,
  editable = false,
  className,
}: PlatformPreviewCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    api.on('select', () => setCurrent(api.selectedScrollSnap()));
  }, [api]);

  useEffect(() => {
    api?.scrollTo(0);
    setCurrent(0);
  }, [platforms.join(','), api]);

  if (!platforms.length) {
    return (
      <div className={`rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground ${className ?? ''}`}>
        Select one or more platforms to preview how your content will look
      </div>
    );
  }

  const displayPayloads =
    Object.keys(platformPayloads).length > 0
      ? platformPayloads
      : buildPlatformPayloads(baseContent, title, platforms);

  const activePlatform = platforms[current];
  const activeDef = activePlatform ? platformOf(activePlatform) : null;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-3">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Platform previews
        </Label>
        {platforms.length > 1 && (
          <span className="text-xs text-muted-foreground">
            {current + 1} / {platforms.length}
          </span>
        )}
      </div>

      <div className="relative px-10">
        <Carousel setApi={setApi} opts={{ align: 'start', loop: platforms.length > 1 }}>
          <CarouselContent>
            {platforms.map((p) => {
              const payload = displayPayloads[p] ?? { content: '', title };
              const def = platformOf(p);
              const Icon = def.icon;
              return (
                <CarouselItem key={p}>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" style={{ color: def.color }} />
                      <span className="text-sm font-medium">{def.label}</span>
                    </div>
                    <PlatformPreview platform={p} payload={payload} mediaUrls={mediaUrls} />
                    {editable && onEditPayload && (
                      <Textarea
                        value={payload.content}
                        onChange={(e) => onEditPayload(p, { content: e.target.value })}
                        rows={3}
                        placeholder={`${def.label} copy…`}
                        className="text-sm"
                      />
                    )}
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>

        {platforms.length > 1 && (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
              disabled={current === 0}
              onClick={() => api?.scrollPrev()}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
              disabled={current >= platforms.length - 1}
              onClick={() => api?.scrollNext()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {platforms.length > 1 && activeDef && (
        <div className="flex justify-center gap-1.5 mt-4">
          {platforms.map((p, i) => {
            const def = platformOf(p);
            const Icon = def.icon;
            return (
              <button
                key={p}
                type="button"
                onClick={() => api?.scrollTo(i)}
                className={`h-2 rounded-full transition-all ${
                  i === current ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/30'
                }`}
                aria-label={def.label}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
