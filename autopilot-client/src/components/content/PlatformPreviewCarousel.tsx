import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  buildPlatformPayloads,
  platformOf,
  PlatformPayload,
  validatePlatformPayload,
} from '@/lib/platforms';
import { PlatformPreview } from './PlatformPreview';
import { PlatformMediaEditor } from './PlatformMediaEditor';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import type { MediaAsset } from '@/lib/mediaUrl';

interface PlatformPreviewCarouselProps {
  platforms: string[];
  platformPayloads?: Record<string, PlatformPayload>;
  title?: string;
  baseContent?: string;
  libraryAssets?: MediaAsset[];
  onEditPayload?: (platform: string, patch: Partial<PlatformPayload>) => void;
  onApplyMediaToAll?: (platform: string) => void;
  onApplyAssetsToAll?: (assets: MediaAsset[]) => void;
  editable?: boolean;
  className?: string;
}

export function PlatformPreviewCarousel({
  platforms,
  platformPayloads = {},
  title = '',
  baseContent = '',
  libraryAssets = [],
  onEditPayload,
  onApplyMediaToAll,
  onApplyAssetsToAll,
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
      <div
        className={`rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground ${className ?? ''}`}
      >
        Select one or more platforms above to preview how your content will look on each channel
      </div>
    );
  }

  const displayPayloads =
    Object.keys(platformPayloads).length > 0
      ? platformPayloads
      : buildPlatformPayloads(baseContent, title, platforms);

  const activePlatform = platforms[current] ?? platforms[0];
  const activeDef = platformOf(activePlatform);
  const activePayload = displayPayloads[activePlatform] ?? { content: '', title };
  const activeValidation = validatePlatformPayload(activePlatform, activePayload);
  const Icon = activeDef.icon;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-3">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Platform preview
        </Label>
        {platforms.length > 1 && (
          <span className="text-xs text-muted-foreground">
            {current + 1} / {platforms.length}
          </span>
        )}
      </div>

      {/* Preview carousel */}
      <div className="relative px-10 mb-5">
        <Carousel setApi={setApi} opts={{ align: 'start', loop: platforms.length > 1 }}>
          <CarouselContent>
            {platforms.map((p) => {
              const payload = displayPayloads[p] ?? { content: '', title };
              const def = platformOf(p);
              const PIcon = def.icon;
              return (
                <CarouselItem key={p}>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <PIcon className="h-4 w-4" style={{ color: def.color }} />
                      <span className="text-sm font-medium">{def.label}</span>
                      <span className="text-[10px] text-muted-foreground">
                        · as it will be sent
                      </span>
                    </div>
                    <PlatformPreview platform={p} payload={payload} />
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

      {platforms.length > 1 && (
        <div className="flex justify-center gap-1.5 mb-5">
          {platforms.map((p, i) => {
            const def = platformOf(p);
            const PIcon = def.icon;
            return (
              <button
                key={p}
                type="button"
                onClick={() => api?.scrollTo(i)}
                className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] border transition-all ${
                  i === current
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <PIcon className="h-3 w-3" style={{ color: i === current ? def.color : undefined }} />
                {def.label.split(' ')[0]}
              </button>
            );
          })}
        </div>
      )}

      {/* Edit section below carousel — active platform */}
      {editable && onEditPayload && (
        <div className="rounded-xl border bg-muted/10 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" style={{ color: activeDef.color }} />
            <span className="text-sm font-semibold">Edit {activeDef.label} post</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`edit-${activePlatform}`} className="text-xs">
              Post copy
              {activeValidation.overCharLimit && (
                <span className="text-destructive ml-1">(over limit)</span>
              )}
            </Label>
            <Textarea
              id={`edit-${activePlatform}`}
              value={activePayload.content}
              onChange={(e) => onEditPayload(activePlatform, { content: e.target.value })}
              rows={4}
              placeholder={`${activeDef.label} copy…`}
              className="text-sm resize-y min-h-[100px]"
            />
            <p className="text-[10px] text-muted-foreground">
              {activeValidation.charCount.toLocaleString()} / {activeDef.maxChars.toLocaleString()}{' '}
              characters · Max {activeDef.media.maxAttachments} attachment(s)
            </p>
          </div>

          <PlatformMediaEditor
            platform={activePlatform}
            payload={activePayload}
            libraryAssets={libraryAssets}
            onChange={(media) => onEditPayload(activePlatform, { media })}
            onApplyToAll={
              onApplyMediaToAll ? () => onApplyMediaToAll(activePlatform) : undefined
            }
            onApplyAssetsToAll={onApplyAssetsToAll}
          />
        </div>
      )}
    </div>
  );
}
