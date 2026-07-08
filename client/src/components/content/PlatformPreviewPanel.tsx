import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { buildPlatformPayloads, platformOf, PlatformPayload } from '@/lib/platforms';
import { PlatformPreview } from './PlatformPreview';

interface PlatformPreviewPanelProps {
  platforms: string[];
  platformPayloads: Record<string, PlatformPayload>;
  title?: string;
  baseContent?: string;
  previewTab: string;
  onPreviewTabChange: (tab: string) => void;
  mediaUrls?: string[];
  onEditPayload?: (platform: string, patch: Partial<PlatformPayload>) => void;
  showEditors?: boolean;
  className?: string;
}

export function PlatformPreviewPanel({
  platforms,
  platformPayloads,
  title = '',
  baseContent = '',
  previewTab,
  onPreviewTabChange,
  mediaUrls = [],
  onEditPayload,
  showEditors = false,
  className,
}: PlatformPreviewPanelProps) {
  if (!platforms.length) {
    return (
      <div className={`rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground ${className ?? ''}`}>
        Select platforms to see live previews
      </div>
    );
  }

  const displayPayloads =
    Object.keys(platformPayloads).length > 0
      ? platformPayloads
      : baseContent.trim() || title.trim()
        ? buildPlatformPayloads(baseContent, title, platforms)
        : Object.fromEntries(platforms.map((p) => [p, { content: '', title: title || platformOf(p).label }]));

  return (
    <div className={className}>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">
        Platform previews
      </Label>
      <Tabs value={previewTab} onValueChange={onPreviewTabChange}>
        <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {platforms.map((p) => {
            const def = platformOf(p);
            const Icon = def.icon;
            return (
              <TabsTrigger key={p} value={p} className="text-xs gap-1.5 px-2.5">
                <Icon className="h-3 w-3" style={{ color: def.color }} />
                {def.label.split(' ')[0]}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {platforms.map((p) => {
          const payload = displayPayloads[p] ?? { content: '', title };
          const payloadWithMedia = {
            ...payload,
            media:
              payload.media?.length
                ? payload.media
                : mediaUrls.map((url) => ({ url, type: 'image' as const })),
          };
          return (
            <TabsContent key={p} value={p} className="space-y-3 mt-3">
              <PlatformPreview platform={p} payload={payloadWithMedia} />
              {showEditors && onEditPayload && (
                <div className="space-y-2">
                  <Label className="text-xs">Edit {platformOf(p).label} copy</Label>
                  <Textarea
                    value={payload.content}
                    onChange={(e) => onEditPayload(p, { content: e.target.value })}
                    rows={4}
                  />
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
