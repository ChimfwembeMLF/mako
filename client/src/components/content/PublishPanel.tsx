import { useEffect, useState, useCallback, useRef } from 'react';
import { Send, Loader2, Link2, AlertCircle, Sparkles, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  contentItemsApi,
  socialAccountsApi,
  mediaApi,
  contentAiApi,
  whatsappApi,
  whatsappTemplatesApi,
  SocialAccount,
  resolveQueued,
} from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { plainToHtml } from '@/lib/rich-text';
import {
  buildPlatformPayloads,
  formatPublishText,
  platformOf,
  PlatformPayload,
  trimMediaForPlatform,
  validatePlatformPayload,
  PlatformMediaAttachment,
  platformRequiresMedia,
  instagramHasMedia,
  formatPlainPostText,
  formatContentForPlatform,
  PLATFORMS,
} from '@/lib/platforms';
import { normalizeMediaAsset, type MediaAsset } from '@/lib/mediaUrl';
import { toPublishMediaUrl } from '@/lib/publishContent';
import { PlatformPreview } from './PlatformPreview';
import { PlatformMediaEditor } from './PlatformMediaEditor';
import RichTextEditor from '@/components/RichTextEditor';
import { normalizeRichContent } from '@/lib/rich-text';
import { cn } from '@/lib/utils';
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
  const { activeWorkspace, workspaceVersion } = useWorkspace();
  const workspaceId = item.workspaceId ?? item.workspace_id ?? activeWorkspace ?? undefined;

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
    if (!tenant?.id || !workspaceId) return;
    try {
      const rows = await mediaApi.findAll(tenant.id, workspaceId);
      const all = (Array.isArray(rows) ? rows : []).map((r) =>
        normalizeMediaAsset(r as Record<string, unknown>),
      );
      const linked = all.filter((a) => a.contentId === item.id);
      const rest = all.filter((a) => a.contentId !== item.id);
      setLibraryAssets([...linked, ...rest]);
    } catch {
      setLibraryAssets([]);
    }
  }, [tenant?.id, item.id, workspaceId]);

  useEffect(() => {
    if (!tenant?.id || !workspaceId || !selectedPlatforms.includes('whatsapp')) {
      setWaTemplates([]);
      return;
    }
    let cancelled = false;
    (async () => {
      // Prefer local APPROVED registry (imported templates), then Meta HSM list.
      const [localResult, metaResult] = await Promise.allSettled([
        whatsappTemplatesApi.list(tenant.id, workspaceId),
        whatsappApi.listTemplates(tenant.id, workspaceId),
      ]);

      if (cancelled) return;

      const fromLocal =
        localResult.status === 'fulfilled' && Array.isArray(localResult.value)
          ? localResult.value
            .filter((t) => String(t.status ?? '').toUpperCase() === 'APPROVED')
            .map((t) => ({
              name: String(t.name),
              language: String(t.language ?? 'en'),
            }))
          : [];

      const meta =
        metaResult.status === 'fulfilled' ? metaResult.value : null;
      const fromMeta = (meta?.templates ?? []).map((t) => ({
        name: t.name,
        language: t.language ?? 'en',
      }));

      const byKey = new Map<string, { name: string; language: string }>();
      for (const t of [...fromLocal, ...fromMeta]) {
        byKey.set(`${t.name}::${t.language}`, t);
      }
      const merged = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
      setWaTemplates(merged);

      const defaultName =
        meta?.defaultTemplate ||
        merged.find((t) => t.name === 'hello_world')?.name ||
        merged[0]?.name ||
        'hello_world';
      setWaDefaultTemplate(defaultName);

      setPlatformPayloads((prev) => {
        if (prev.whatsapp?.whatsappTemplate) return prev;
        const pick = merged.find((t) => t.name === defaultName) ?? merged[0];
        return {
          ...prev,
          whatsapp: {
            ...prev.whatsapp,
            content: prev.whatsapp?.content ?? '',
            whatsappTemplate: pick?.name ?? defaultName,
            whatsappTemplateLanguage: pick?.language ?? 'en',
            whatsappUseTemplate: true,
          },
        };
      });
    })().catch(() => {
      if (!cancelled) setWaTemplates([]);
    });

    return () => {
      cancelled = true;
    };
  }, [tenant?.id, workspaceId, selectedPlatforms.includes('whatsapp')]);

  useEffect(() => {
    if (!tenant?.id || !workspaceId) return;
    socialAccountsApi
      .findByTenant(tenant.id, workspaceId)
      .then((data) => setConnectedAccounts(Array.isArray(data) ? data : []))
      .catch(() => setConnectedAccounts([]));
    void loadLibrary();
  }, [tenant?.id, workspaceId, workspaceVersion, loadLibrary]);

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
            content: formatPlainPostText(saved.content ?? next[p].content),
            title: saved.title ?? next[p].title,
            media: saved.media !== undefined ? saved.media : next[p].media,
          };
          next[p].content = formatContentForPlatform(p, next[p].content);
        }
      }
    }

    setPlatformPayloads(next);
  }, [selectedPlatforms.join(','), item.id, item.content, item.title, item.platformPayloads]);

  // Pre-attach the media uploaded with this draft in the composer, so users
  // don't have to re-import it per platform. Platforms with saved or already
  // chosen media are left untouched.
  useEffect(() => {
    const linked = libraryAssets.filter((a) => a.contentId === item.id);
    if (!linked.length || !selectedPlatforms.length) return;
    const baseMedia = toMediaAttachments(linked);
    setPlatformPayloads((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const p of selectedPlatforms) {
        const current = next[p];
        if (!current) continue;
        if (current.media?.length) continue;
        if (item.platformPayloads?.[p]?.media !== undefined) continue;
        next[p] = { ...current, media: trimMediaForPlatform(p, baseMedia) };
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [libraryAssets, selectedPlatforms.join(','), item.id, item.platformPayloads]);

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
          workspaceId,
        }),
      )) as { payloads?: Record<string, { title: string; content: string }> } | null;
      if (!adapted?.payloads) {
        throw new Error('AI adapt returned no platform copy. Restart the API and try again.');
      }
      const { payloads } = adapted;
      setPlatformPayloads((prev) => {
        const next = { ...prev };
        for (const p of selectedPlatforms) {
          if (payloads[p]) {
            next[p] = {
              ...next[p],
              title: payloads[p].title,
              content: plainToHtml(payloads[p].content),
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

  const validationIssues = selectedPlatforms.flatMap((p) => {
    const v = validatePlatformPayload(p, platformPayloads[p] ?? { content: '' });
    return v.errors.map((e) => ({ platform: p, message: e }));
  });

  const [savingDraft, setSavingDraft] = useState(false);

  const saveChanges = async (
    platformsToSave: string[],
    payloadsToUse: Record<string, PlatformPayload>,
  ) => {
    if (!tenant?.id) throw new Error('Tenant context missing');

    const rawPayloads: Record<string, PlatformPayload> = {};
    const fallback = buildPlatformPayloads(item.content ?? '', item.title ?? '', platformsToSave);
    for (const p of platformsToSave) {
      rawPayloads[p] = payloadsToUse[p] ?? fallback[p];
    }
    const publishPayloads = normalizePayloadsForPublish(rawPayloads);

    await contentItemsApi.update(item.id, {
      platforms: selectedPlatforms,
      platformPayloads: publishPayloads,
    } as Parameters<typeof contentItemsApi.update>[1]);

    const mediaByUrl = new Map<string, { url: string; type: string; assetId?: string }>();
    for (const p of platformsToSave) {
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
    return { publishPayloads };
  };

  const handleSaveDraftOnly = async () => {
    if (!selectedPlatforms.length) {
      toast({ title: 'Select at least one platform', variant: 'destructive' });
      return;
    }
    setSavingDraft(true);
    try {
      const platformsToSave = selectedPlatforms;
      const payloadsToUse = { ...platformPayloads };

      // Ensure proper formatting for draft saving
      for (const p of platformsToSave) {
        if (payloadsToUse[p]?.content) {
          payloadsToUse[p] = {
            ...payloadsToUse[p],
            content: plainToHtml(payloadsToUse[p].content),
          };
        }
      }

      await saveChanges(platformsToSave, payloadsToUse);
      toast({
        title: 'Draft saved successfully',
        description: 'Your per-platform customizations and media attachments have been saved.',
      });
      onPublished();
    } catch (err: unknown) {
      toast({
        title: 'Save draft failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setSavingDraft(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedPlatforms.length) {
      toast({ title: 'Select at least one platform', variant: 'destructive' });
      return;
    }

    const missingMedia = selectedPlatforms.filter(
      (p) =>
        platformRequiresMedia(p) &&
        !instagramHasMedia(platformPayloads[p], linkedCount),
    );
    if (missingMedia.length > 0) {
      toast({
        title: 'Media required',
        description: `${missingMedia.map((p) => platformOf(p).label).join(', ')} requires at least one image or video. Add media or deselect those platforms.`,
        variant: 'destructive',
      });
      return;
    }

    const publishValidationIssues = selectedPlatforms.flatMap((p) => {
      const v = validatePlatformPayload(p, platformPayloads[p] ?? { content: '' });
      return v.errors.map((e) => ({ platform: p, message: e }));
    });

    if (publishValidationIssues.length > 0) {
      toast({
        title: 'Fix validation issues',
        description: publishValidationIssues[0].message,
        variant: 'destructive',
      });
      return;
    }
    if (!tenant) return;

    setPublishing(true);
    try {
      let payloadsToUse = { ...platformPayloads };
      const platformsToPublish = selectedPlatforms;

      // Publish the copy exactly as the user wrote or edited it. AI platform
      // adaptation is opt-in via "Generate AI copy for selected platforms" and
      // must never block publishing (an AI outage or rate limit used to stall it).
      for (const p of platformsToPublish) {
        payloadsToUse[p] = {
          ...payloadsToUse[p],
          content: plainToHtml(
            formatPublishText(p, payloadsToUse[p]?.content ?? item.content ?? ''),
          ),
        };
      }

      const { publishPayloads } = await saveChanges(platformsToPublish, payloadsToUse);

      const { submitPublish } = await import('@/lib/publishContent');
      const result = await submitPublish(
        item.id,
        platformsToPublish,
        publishPayloads,
        (t) => toast(t),
        {
          waitInForeground: true,
          contentType: platformsToPublish[0],
        },
      );

      const anySuccess =
        result?.published ||
        Object.values(result?.results ?? {}).some((r) => r.published);
      if (anySuccess) {
        onPublished();
      }
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

  // The channel being edited and previewed.
  const [activePlatform, setActivePlatform] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedPlatforms.length) setActivePlatform(null);
    else if (!activePlatform || !selectedPlatforms.includes(activePlatform)) setActivePlatform(selectedPlatforms[0]);
  }, [selectedPlatforms, activePlatform]);

  const accountsFor = (p: string) => connectedAccounts.filter((a) => a.connected && a.platform === p);
  const postingAccount = (p: string) => {
    const list = accountsFor(p);
    const chosen = platformPayloads[p]?.accountId;
    return list.find((a) => a.id === chosen) ?? list.find((a) => a.metadata?.is_default === true) ?? list[0];
  };
  const issuesFor = (p: string) => {
    const out = validationIssues.filter((i) => i.platform === p).map((i) => i.message);
    if (platformRequiresMedia(p) && !instagramHasMedia(platformPayloads[p], linkedCount)) {
      out.push(`${platformOf(p).label} needs an image or video.`);
    }
    if (!connectedPlatforms.has(p)) out.push(`${platformOf(p).label} isn't connected for this workspace.`);
    return out;
  };
  const allIssues = selectedPlatforms.flatMap((p) => issuesFor(p).map((m) => ({ platform: p, message: m })));
  const blockingIssues = allIssues.filter((i) => !i.message.includes("isn't connected"));
  const channelList = [...PLATFORMS].sort(
    (x, y) => Number(connectedPlatforms.has(y.value)) - Number(connectedPlatforms.has(x.value)),
  );
  const [showAllChannels, setShowAllChannels] = useState(false);
  // Connected and chosen channels first; the rest wait behind "not connected".
  const visibleChannels = showAllChannels
    ? channelList
    : channelList.filter((p) => connectedPlatforms.has(p.value) || selectedPlatforms.includes(p.value));
  const hiddenCount = channelList.length - visibleChannels.length;
  const toggleChannel = (value: string) =>
    setSelectedPlatforms((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));

  const active = activePlatform;
  const activeDef = active ? platformOf(active) : null;
  const activePayload = active ? platformPayloads[active] ?? { content: item.content ?? '', title: item.title } : null;
  const activeValidation = active && activePayload ? validatePlatformPayload(active, activePayload) : null;
  const activeAccounts = active ? accountsFor(active) : [];
  const ActiveIcon = activeDef?.icon;
  const names = (list: string[]) => {
    const labels = list.map((p) => platformOf(p).label);
    return labels.length <= 1 ? labels.join('') : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4 sm:px-6">
        <div className="min-w-0 pr-6">
          <p className="text-xs font-medium text-muted-foreground">Publish</p>
          <h2 className="truncate font-display text-lg font-semibold sm:text-xl">{item.title || 'Untitled post'}</h2>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Channels */}
        <section className="border-b px-5 py-4 sm:px-6" aria-labelledby="publish-channels">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 id="publish-channels" className="text-sm font-semibold">
              Channels{' '}
              <span className="font-normal text-muted-foreground">
                {selectedPlatforms.length ? `· ${selectedPlatforms.length} selected` : '· pick at least one'}
              </span>
            </h3>
            {selectedPlatforms.length > 0 && (
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-full text-xs" onClick={() => void handleGenerateWithAi()} disabled={generating}>
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-primary" />}
                {generating ? 'Rewriting…' : 'Rewrite for each channel'}
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {visibleChannels.map((p) => {
              const selected = selectedPlatforms.includes(p.value);
              const connected = connectedPlatforms.has(p.value);
              const Icon = p.icon;
              return (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleChannel(p.value)}
                  title={connected ? undefined : `${p.label} isn't connected for this workspace`}
                  className={cn(
                    'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected
                      ? 'border-primary bg-primary/10 font-medium text-foreground'
                      : connected
                        ? 'border-border bg-card text-foreground/80 hover:border-foreground/30'
                        : 'border-dashed border-border bg-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" style={{ color: connected || selected ? p.color : undefined }} />
                  {p.label}
                  {selected ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    !connected && <span className="text-[10px]">Not connected</span>
                  )}
                </button>
              );
            })}
            {(hiddenCount > 0 || showAllChannels) && (
              <button
                type="button"
                onClick={() => setShowAllChannels((v) => !v)}
                className="inline-flex h-9 items-center rounded-full px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {showAllChannels ? 'Show fewer' : `+${hiddenCount} not connected`}
              </button>
            )}
          </div>
          {missingConnect.length > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {names(missingConnect)} {missingConnect.length === 1 ? "isn't" : "aren't"} connected yet, so {missingConnect.length === 1 ? 'it' : 'they'} will be skipped.
              <Link to="/publisher" className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline">
                <Link2 className="h-3 w-3" /> Connect
              </Link>
            </p>
          )}
        </section>

        {!active || !activeDef || !activePayload || !activeValidation ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <Send className="h-6 w-6 text-muted-foreground" />
            <p className="mt-3 font-medium">Pick where to publish</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Choose one or more channels above. You can adjust the text and media for each before it goes out.
            </p>
          </div>
        ) : (
          <>
            {/* One tab per chosen channel */}
            <div className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b bg-background/95 px-3 backdrop-blur [scrollbar-width:none] sm:px-4 [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Edit each channel">
              {selectedPlatforms.map((p) => {
                const def = platformOf(p);
                const Icon = def.icon;
                const problems = issuesFor(p).filter((m) => !m.includes("isn't connected")).length;
                const isActive = p === active;
                return (
                  <button
                    key={p}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActivePlatform(p)}
                    className={cn(
                      "relative flex shrink-0 items-center gap-1.5 px-3 pb-2.5 pt-3 text-sm transition-colors after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:content-['']",
                      isActive ? 'font-medium text-foreground after:bg-primary' : 'text-muted-foreground hover:text-foreground after:bg-transparent',
                    )}
                  >
                    <Icon className="h-4 w-4" style={{ color: def.color }} />
                    {def.label}
                    {problems > 0 ? (
                      <span className="h-2 w-2 rounded-full bg-destructive" aria-label={`${problems} problem${problems === 1 ? '' : 's'}`} />
                    ) : (
                      <Check className="h-3.5 w-3.5 text-green-600" aria-label="Ready" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="grid gap-6 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
              {/* Edit */}
              <div className="min-w-0 space-y-5">
                {activeAccounts.length > 1 && (
                  <div className="space-y-1.5">
                    <Label className="text-sm">Post from</Label>
                    <Select
                      value={platformPayloads[active]?.accountId || 'default'}
                      onValueChange={(v) => updatePayload(active, { accountId: v === 'default' ? undefined : v })}
                    >
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">
                          Default ({(activeAccounts.find((a) => a.metadata?.is_default === true) ?? activeAccounts[0])?.accountName ?? 'first account'})
                        </SelectItem>
                        {activeAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.accountName || a.username || a.id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {active === 'whatsapp' && (
                  <div className="space-y-1.5">
                    <Label className="text-sm">Message template</Label>
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
                      <SelectTrigger className="h-10"><SelectValue placeholder="Select template" /></SelectTrigger>
                      <SelectContent>
                        {(waTemplates.length ? waTemplates : [{ name: waDefaultTemplate, language: 'en' }]).map((t) => (
                          <SelectItem key={`${t.name}-${t.language}`} value={t.name}>
                            {t.name} ({t.language})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      WhatsApp only lets businesses message people first with a template Meta has approved.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm">Text for {activeDef.label}</Label>
                    <span className={cn('text-xs tabular-nums', activeValidation.overCharLimit ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                      {activeValidation.charCount.toLocaleString()} / {activeDef.maxChars.toLocaleString()}
                    </span>
                  </div>
                  <RichTextEditor
                    key={active}
                    value={normalizeRichContent(activePayload.content)}
                    onChange={(html) => updatePayload(active, { content: html })}
                    placeholder={`What to post on ${activeDef.label}…`}
                    minHeight="160px"
                  />
                  <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div
                      className={cn('h-full rounded-full transition-[width]', activeValidation.overCharLimit ? 'bg-destructive' : 'bg-primary')}
                      style={{ width: `${Math.min(100, (activeValidation.charCount / Math.max(1, activeDef.maxChars)) * 100)}%` }}
                    />
                  </div>
                </div>

                <PlatformMediaEditor
                  platform={active}
                  payload={activePayload}
                  libraryAssets={libraryAssets}
                  onChange={(media) => updatePayload(active, { media })}
                  onApplyToAll={selectedPlatforms.length > 1 ? () => applyMediaToAll(active) : undefined}
                  onApplyAssetsToAll={applyAssetsToAll}
                  onLibraryUpdate={loadLibrary}
                />
              </div>

              {/* Preview */}
              <aside className="min-w-0 lg:sticky lg:top-16 lg:self-start" aria-label={`${activeDef.label} preview`}>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  {ActiveIcon && <ActiveIcon className="h-3.5 w-3.5" style={{ color: activeDef.color }} />}
                  How it will look on {activeDef.label}
                </p>
                <PlatformPreview
                  platform={active}
                  payload={activePayload}
                  authorName={postingAccount(active)?.accountName || tenant?.name || undefined}
                  className="w-full max-w-none"
                />
                {issuesFor(active).length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {issuesFor(active).map((m) => (
                      <li key={m} className="flex items-start gap-1.5 text-xs text-destructive">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {m}
                      </li>
                    ))}
                  </ul>
                )}
              </aside>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex shrink-0 flex-col gap-3 border-t bg-background px-5 py-3 sm:flex-row sm:items-center sm:px-6">
        <p className={cn('flex min-w-0 flex-1 items-center gap-1.5 text-xs', blockingIssues.length ? 'text-destructive' : 'text-muted-foreground')}>
          {!selectedPlatforms.length ? (
            'No channels chosen'
          ) : blockingIssues.length ? (
            <>
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                Fix {blockingIssues.length} problem{blockingIssues.length === 1 ? '' : 's'}: {blockingIssues[0].message}
              </span>
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5 shrink-0 text-green-600" />
              <span className="truncate">Ready to publish to {names(selectedPlatforms.filter((p) => connectedPlatforms.has(p)))}</span>
            </>
          )}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} className="hidden sm:inline-flex">
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleSaveDraftOnly()}
            disabled={savingDraft || publishing || generating || !selectedPlatforms.length}
            className="flex-1 gap-1.5 rounded-full sm:flex-none"
          >
            {savingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save draft
          </Button>
          <Button
            type="button"
            className="flex-1 gap-1.5 rounded-full sm:flex-none sm:px-6"
            onClick={() => void handlePublish()}
            disabled={publishing || generating || !selectedPlatforms.length || validationIssues.length > 0}
          >
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {publishing ? 'Publishing…' : `Publish${selectedPlatforms.length ? ` to ${selectedPlatforms.length}` : ''}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
