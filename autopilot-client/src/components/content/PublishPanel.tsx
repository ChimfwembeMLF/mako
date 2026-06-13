import { useEffect, useState, useCallback, useRef } from 'react';
import { Send, Loader2, X, Link2, AlertCircle, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import {
  contentItemsApi,
  socialAccountsApi,
  mediaApi,
  contentAiApi,
  whatsappApi,
  SocialAccount,
  resolveQueued,
} from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  buildPlatformPayloads,
  platformOf,
  PlatformPayload,
  trimMediaForPlatform,
  validatePlatformPayload,
  PlatformMediaAttachment,
  platformRequiresMedia,
  instagramHasMedia,
} from '@/lib/platforms';
import { normalizeMediaAsset, type MediaAsset } from '@/lib/mediaUrl';
import { PlatformPickerCarousel } from './PlatformPickerCarousel';
import { PlatformPreviewCarousel } from './PlatformPreviewCarousel';
import { ContentItem } from './types';

interface PublishPanelProps {
  item: ContentItem;
  onCancel: () => void;
  onPublished: () => void;
}

function toMediaAttachments(assets: MediaAsset[]): PlatformMediaAttachment[] {
  return assets.map((a) => ({
    url: a.mediaUrl,
    type: a.mediaType === 'video' ? 'video' : 'image',
    name: a.name ?? undefined,
    fileSizeBytes: a.fileSizeBytes ?? undefined,
  }));
}

/** Send relative /uploads paths so the API can resolve public URLs server-side. */
function toPublishMediaUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('/uploads/')) return url;
  if (/supabase\.co\/storage\//i.test(url)) return url;
  const match = url.match(/\/uploads\/[^?#]+/);
  if (match) return match[0];
  return url;
}

function normalizePayloadsForPublish(
  payloads: Record<string, PlatformPayload>,
): Record<string, PlatformPayload> {
  const out: Record<string, PlatformPayload> = {};
  for (const [platform, payload] of Object.entries(payloads)) {
    out[platform] = {
      ...payload,
      media: payload.media?.map((m) => ({
        ...m,
        url: toPublishMediaUrl(m.url),
      })),
    };
  }
  return out;
}

export function PublishPanel({ item, onCancel, onPublished }: PublishPanelProps) {
  const { toast } = useToast();
  const { tenant } = useTenant();

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [platformPayloads, setPlatformPayloads] = useState<Record<string, PlatformPayload>>({});
  const [publishing, setPublishing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState<SocialAccount[]>([]);
  const [libraryAssets, setLibraryAssets] = useState<MediaAsset[]>([]);
  const initKeyRef = useRef('');
  const [waTemplates, setWaTemplates] = useState<Array<{ name: string; language: string }>>([]);
  const [waDefaultTemplate, setWaDefaultTemplate] = useState('hello_world');

  const loadLibrary = useCallback(async () => {
    if (!tenant?.id) return;
    try {
      const rows = await mediaApi.findAll(tenant.id);
      const all = (Array.isArray(rows) ? rows : []).map((r) =>
        normalizeMediaAsset(r as Record<string, unknown>),
      );
      const linked = all.filter((a) => a.contentId === item.id);
      const rest = all.filter((a) => a.contentId !== item.id);
      setLibraryAssets([...linked, ...rest]);
    } catch {
      setLibraryAssets([]);
    }
  }, [tenant?.id, item.id]);

  useEffect(() => {
    if (!tenant?.id || !selectedPlatforms.includes('whatsapp')) {
      setWaTemplates([]);
      return;
    }
    whatsappApi
      .listTemplates(tenant.id)
      .then((res) => {
        setWaTemplates(res.templates ?? []);
        if (res.defaultTemplate) setWaDefaultTemplate(res.defaultTemplate);
        setPlatformPayloads((prev) => {
          if (prev.whatsapp?.whatsappTemplate) return prev;
          return {
            ...prev,
            whatsapp: {
              ...prev.whatsapp,
              content: prev.whatsapp?.content ?? '',
              whatsappTemplate: res.defaultTemplate ?? 'hello_world',
              whatsappTemplateLanguage: res.templates?.[0]?.language ?? 'en',
              whatsappUseTemplate: true,
            },
          };
        });
      })
      .catch(() => setWaTemplates([]));
  }, [tenant?.id, selectedPlatforms.includes('whatsapp')]);

  useEffect(() => {
    if (!tenant?.id) return;
    socialAccountsApi
      .findByTenant(tenant.id)
      .then((data) => setConnectedAccounts(Array.isArray(data) ? data : []))
      .catch(() => setConnectedAccounts([]));
    void loadLibrary();
  }, [tenant?.id, loadLibrary]);

  useEffect(() => {
    const existing = item.platforms?.length ? item.platforms : [];
    setSelectedPlatforms(existing);
  }, [item.id, item.platforms?.join(',')]);

  useEffect(() => {
    if (!selectedPlatforms.length) {
      setPlatformPayloads({});
      initKeyRef.current = '';
      return;
    }

    const key = `${item.id}:${selectedPlatforms.join(',')}`;
    if (initKeyRef.current === key) return;
    initKeyRef.current = key;

    const next = buildPlatformPayloads(
      item.content ?? '',
      item.title ?? '',
      selectedPlatforms,
      [],
    );

    if (item.platformPayloads && Object.keys(item.platformPayloads).length) {
      for (const p of selectedPlatforms) {
        const saved = item.platformPayloads[p];
        if (saved) {
          next[p] = {
            ...next[p],
            content: saved.content ?? next[p].content,
            title: saved.title ?? next[p].title,
            media: saved.media !== undefined ? saved.media : next[p].media,
          };
        }
      }
    }

    setPlatformPayloads(next);
  }, [selectedPlatforms.join(','), item.id, item.content, item.title, item.platformPayloads]);

  const updatePayload = (platform: string, patch: Partial<PlatformPayload>) => {
    setPlatformPayloads((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], ...patch },
    }));
  };

  const applyMediaToAll = (sourcePlatform: string) => {
    const sourceMedia = platformPayloads[sourcePlatform]?.media ?? [];
    if (!sourceMedia.length) return;
    setPlatformPayloads((prev) => {
      const next = { ...prev };
      for (const p of selectedPlatforms) {
        next[p] = {
          ...next[p],
          media: trimMediaForPlatform(p, sourceMedia),
        };
      }
      return next;
    });
    toast({
      title: 'Media applied',
      description: 'Attachments copied to all selected platforms (trimmed to each limit).',
    });
  };

  const applyAssetsToAll = (assets: MediaAsset[]) => {
    if (!assets.length) return;
    const baseMedia = toMediaAttachments(assets);
    setPlatformPayloads((prev) => {
      const next = { ...prev };
      for (const p of selectedPlatforms) {
        next[p] = {
          ...next[p],
          media: trimMediaForPlatform(p, baseMedia),
        };
      }
      return next;
    });
    toast({
      title: 'Media applied',
      description: `Added ${assets.length} attachment(s) to all selected platforms.`,
    });
  };

  const handleGenerateWithAi = async () => {
    if (!tenant || !selectedPlatforms.length) {
      toast({ title: 'Select platforms first', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      const adapted = (await resolveQueued(
        await contentAiApi.adaptPlatforms({
          tenantId: tenant.id,
          platforms: selectedPlatforms,
          title: item.title,
          content: item.content ?? '',
        }),
      )) as { payloads: Record<string, { title: string; content: string }> };
      const { payloads } = adapted;
      setPlatformPayloads((prev) => {
        const next = { ...prev };
        for (const p of selectedPlatforms) {
          if (payloads[p]) {
            next[p] = {
              ...next[p],
              title: payloads[p].title,
              content: payloads[p].content,
              media: next[p]?.media,
            };
          }
        }
        return next;
      });
      toast({
        title: 'AI copy ready',
        description: `Adapted for ${selectedPlatforms.map((p) => platformOf(p).label).join(', ')}.`,
      });
    } catch (err: unknown) {
      toast({
        title: 'AI generation failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const connectedPlatforms = new Set(
    connectedAccounts.filter((a) => a.connected).map((a) => a.platform),
  );
  const missingConnect = selectedPlatforms.filter((p) => !connectedPlatforms.has(p));

  const linkedCount = libraryAssets.filter((a) => a.contentId === item.id).length;
  const publishablePlatforms = selectedPlatforms.filter(
    (p) => !platformRequiresMedia(p) || instagramHasMedia(platformPayloads[p], linkedCount),
  );

  const validationIssues = publishablePlatforms.flatMap((p) => {
    const v = validatePlatformPayload(p, platformPayloads[p] ?? { content: '' });
    return v.errors.map((e) => ({ platform: p, message: e }));
  });

  const handlePublish = async () => {
    if (!selectedPlatforms.length) {
      toast({ title: 'Select at least one platform', variant: 'destructive' });
      return;
    }

    const skippedInstagram = selectedPlatforms.filter(
      (p) =>
        platformRequiresMedia(p) &&
        !instagramHasMedia(platformPayloads[p], libraryAssets.filter((a) => a.contentId === item.id).length),
    );
    const platformsToPublish = selectedPlatforms.filter((p) => !skippedInstagram.includes(p));

    if (platformsToPublish.length === 0) {
      toast({
        title: 'Nothing to publish',
        description: 'Instagram requires at least one attachment. Add media or deselect Instagram.',
        variant: 'destructive',
      });
      return;
    }

    if (skippedInstagram.length > 0) {
      toast({
        title: 'Instagram skipped',
        description: 'Instagram requires an image or video — publishing other selected platforms only.',
      });
    }

    const validationIssues = platformsToPublish.flatMap((p) => {
      const v = validatePlatformPayload(p, platformPayloads[p] ?? { content: '' });
      return v.errors.map((e) => ({ platform: p, message: e }));
    });

    if (validationIssues.length > 0) {
      toast({
        title: 'Fix validation issues',
        description: validationIssues[0].message,
        variant: 'destructive',
      });
      return;
    }
    if (!tenant) return;

    setPublishing(true);
    try {
      const rawPayloads =
        Object.keys(platformPayloads).length > 0
          ? platformPayloads
          : buildPlatformPayloads(item.content ?? '', item.title ?? '', platformsToPublish);
      const publishPayloads = normalizePayloadsForPublish(rawPayloads);

      const mediaByUrl = new Map<string, { url: string; type: string; assetId?: string }>();
      for (const p of platformsToPublish) {
        for (const m of publishPayloads[p]?.media ?? []) {
          const url = toPublishMediaUrl(m.url);
          const asset = libraryAssets.find(
            (a) => a.mediaUrl === m.url || toPublishMediaUrl(a.mediaUrl) === url,
          );
          mediaByUrl.set(url, { url, type: m.type, assetId: asset?.id });
        }
      }
      if (mediaByUrl.size > 0) {
        await contentItemsApi.attachMedia(
          item.id,
          tenant.id,
          Array.from(mediaByUrl.values()),
        );
      }

      await contentItemsApi.update(item.id, {
        platforms: platformsToPublish,
        platformPayloads: rawPayloads,
        contentType: platformsToPublish[0],
        status: 'approved',
      } as any);

      try {
        const { submitPublish } = await import('@/lib/publishContent');
        await submitPublish(
          item.id,
          platformsToPublish,
          publishPayloads,
          (t) => toast(t),
        );
      } catch (err: unknown) {
        toast({
          title: 'Publish issue',
          description: err instanceof Error ? err.message : 'Saved targets — check platform connections and public media URLs.',
          variant: 'destructive',
        });
      }
      onPublished();
    } catch (err: unknown) {
      toast({
        title: 'Publish failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="sticky top-0 z-10 bg-background border-b px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="pr-8">
            <h2 className="font-display text-xl font-semibold">Publish content</h2>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Grow Smarter, Sell Stronger with Tekrem Innvation Solutions — pick platforms and preview before publishing.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onCancel} className="shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-3 block">
            Select platforms
          </Label>
          <PlatformPickerCarousel values={selectedPlatforms} onChange={setSelectedPlatforms} />
        </div>

        {selectedPlatforms.includes('whatsapp') && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <Label className="text-sm font-medium">WhatsApp broadcast template</Label>
            <p className="text-xs text-muted-foreground">
              Proactive messages outside the 24h window require a Meta-approved template.
            </p>
            <Select
              value={platformPayloads.whatsapp?.whatsappTemplate ?? waDefaultTemplate}
              onValueChange={(name) => {
                const tpl = waTemplates.find((t) => t.name === name);
                updatePayload('whatsapp', {
                  whatsappTemplate: name,
                  whatsappTemplateLanguage: tpl?.language ?? 'en',
                  whatsappUseTemplate: true,
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                {(waTemplates.length ? waTemplates : [{ name: waDefaultTemplate, language: 'en' }]).map(
                  (t) => (
                    <SelectItem key={`${t.name}-${t.language}`} value={t.name}>
                      {t.name} ({t.language})
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {selectedPlatforms.length > 0 && (
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={handleGenerateWithAi}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {generating ? 'Generating platform copy…' : 'Generate AI copy for selected platforms'}
          </Button>
        )}

        <PlatformPreviewCarousel
          platforms={selectedPlatforms}
          platformPayloads={platformPayloads}
          title={item.title}
          baseContent={item.content}
          libraryAssets={libraryAssets}
          onEditPayload={updatePayload}
          onApplyMediaToAll={applyMediaToAll}
          onApplyAssetsToAll={applyAssetsToAll}
          editable
        />

        {missingConnect.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-800 dark:text-amber-200">
                Not connected for this workspace:{' '}
                {missingConnect.map((p) => platformOf(p).label).join(', ')}
              </p>
              <Link
                to="/publisher"
                className="inline-flex items-center gap-1 text-xs text-primary mt-1 hover:underline"
              >
                <Link2 className="h-3 w-3" /> Connect accounts in Publisher Connect
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 border-t bg-background px-6 py-4 flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          className="flex-1 gradient-primary text-primary-foreground border-0"
          onClick={handlePublish}
          disabled={publishing || generating || !publishablePlatforms.length || validationIssues.length > 0}
        >
          {publishing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Publish to {selectedPlatforms.length || 0} platform{selectedPlatforms.length !== 1 ? 's' : ''}
        </Button>
      </div>
    </div>
  );
}
