import { confirmModal } from "@/components/ConfirmModal";
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  Plus, Sparkles, Trash2, Loader2, Pencil, Send, Eye, Search, HelpCircle, MoreHorizontal,
  Copy, Repeat2, FileText, Megaphone, X, ChevronLeft, ChevronRight, Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { brandProfilesApi, contentAiApi, contentItemsApi, queued, type ContentStatusGroup } from '@/lib/api';
import { PLATFORMS, platformOf } from '@/lib/platforms';
import { getPostDisplayStatus, POST_STATUS_META } from '@/lib/post-status';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { cn } from '@/lib/utils';
import { isBrandVoiceStarted } from '@/lib/onboarding-gate';
import { ContentItem } from '@/components/content/types';
import { ContentEditor } from '@/components/content/ContentEditor';
import { PublishPanel } from '@/components/content/PublishPanel';
import { TourService } from '@/services/tour.service';
import { contentEngineTourConfig } from './ContentEngine.tour';

const PAGE_SIZE = 10;

type Tab = 'all' | ContentStatusGroup;
const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'published', label: 'Published' },
  { id: 'failed', label: 'Failed' },
];

function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

function shortDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** When a post goes out, went out, or was written, in the words a planner would use. */
function whenLabel(item: ContentItem): string {
  const status = getPostDisplayStatus({
    status: item.status ?? 'draft',
    scheduled_date: item.scheduled_date ?? null,
    scheduled_time: item.scheduled_time ?? null,
    publish_failed_reason: item.publish_failed_reason,
  });
  if ((status === 'scheduled' || status === 'overdue' || status === 'needs_approval') && item.scheduled_date) {
    const time = item.scheduled_time ? ` · ${item.scheduled_time.slice(0, 5)}` : '';
    return `${status === 'overdue' ? 'Was due' : 'Goes out'} ${shortDate(item.scheduled_date)}${time}`;
  }
  return `Created ${shortDate(item.created_at)}`;
}

function StatusBadge({ item }: { item: ContentItem }) {
  const status = getPostDisplayStatus({
    status: item.status ?? 'draft',
    scheduled_date: item.scheduled_date ?? null,
    scheduled_time: item.scheduled_time ?? null,
    publish_failed_reason: item.publish_failed_reason,
  });
  const meta = POST_STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', meta.badge)}
      title={status === 'failed' && item.publish_failed_reason ? item.publish_failed_reason : meta.hint}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function Thumb({ item }: { item: ContentItem }) {
  const [broken, setBroken] = useState(false);
  const showImage = item.preview_url && item.preview_type !== 'video' && !broken;
  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted/60">
      {showImage ? (
        <img
          src={resolveMediaUrl(item.preview_url!)}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-muted-foreground/60">
          {item.preview_type === 'video' ? <Video className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        </span>
      )}
      {(item.media_count ?? 0) > 1 && (
        <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 text-[9px] font-semibold text-white">
          +{(item.media_count ?? 1) - 1}
        </span>
      )}
    </div>
  );
}

function PlatformIcons({ platforms }: { platforms: string[] }) {
  if (!platforms.length) return <span className="text-xs text-muted-foreground">No channels yet</span>;
  return (
    <div className="flex items-center -space-x-1">
      {platforms.slice(0, 4).map((p) => {
        const plat = platformOf(p);
        const Icon = plat.icon;
        return (
          <span
            key={p}
            title={plat.label}
            className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-muted"
          >
            <Icon size={12} style={{ color: plat.color }} />
          </span>
        );
      })}
      {platforms.length > 4 && (
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-card bg-muted px-1 text-[10px] font-semibold text-muted-foreground">
          +{platforms.length - 4}
        </span>
      )}
    </div>
  );
}

function PostRow({
  item,
  selected,
  onSelect,
  onEdit,
  onPublish,
  onRepurpose,
  onCopy,
  onDelete,
  repurposing,
}: {
  item: ContentItem;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onEdit: () => void;
  onPublish: () => void;
  onRepurpose: () => void;
  onCopy: () => void;
  onDelete: () => void;
  repurposing: boolean;
}) {
  const navigate = useNavigate();
  const platforms = item.platforms ?? [];
  const published = item.status === 'published';
  const snippet = plainText(item.content ?? '');

  return (
    <li
      className={cn(
        'group relative flex items-center gap-3 px-3 py-3 transition-colors sm:gap-4 sm:px-4',
        selected ? 'bg-primary/5' : 'hover:bg-muted/40',
      )}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={(v) => onSelect(Boolean(v))}
        aria-label={`Select ${item.title || 'post'}`}
        // Above the row-wide title link, so ticking the box selects instead of opening the post.
        className="relative z-10 shrink-0"
      />
      <Thumb item={item} />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          {/* The title is the row's main link; the whole row opens the post. */}
          <Link
            to={`/content/${item.id}`}
            className="truncate text-sm font-medium text-foreground after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {item.title || 'Untitled post'}
          </Link>
          <span className="hidden md:inline-flex">
            <StatusBadge item={item} />
          </span>
        </div>
        <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{snippet || 'No text yet'}</p>
        {/* Phones: status, channels and date share one line so the title gets the full width. */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 md:hidden">
          <StatusBadge item={item} />
          <PlatformIcons platforms={platforms} />
          <span className="text-xs text-muted-foreground">{whenLabel(item)}</span>
        </div>
      </div>

      <div className="hidden w-28 shrink-0 md:block">
        <PlatformIcons platforms={platforms} />
      </div>
      <span className="hidden w-36 shrink-0 text-xs text-muted-foreground lg:block">{whenLabel(item)}</span>

      {/* Sit above the row link so these stay clickable. */}
      <div className="relative z-10 flex shrink-0 items-center justify-end gap-1 sm:w-[132px]">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="hidden h-8 gap-1.5 rounded-full text-xs sm:inline-flex"
          onClick={published ? () => navigate(`/content/${item.id}`) : onPublish}
        >
          {published ? <Eye className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
          {published ? 'View' : 'Publish'}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-full" aria-label={`More actions for ${item.title || 'post'}`}>
              {repurposing ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onPublish} className="gap-2 sm:hidden">
              <Send className="h-4 w-4" /> Publish
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit} className="gap-2">
              <Pencil className="h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="gap-2">
              <Link to={`/content/${item.id}`}>
                <Eye className="h-4 w-4" /> Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRepurpose} disabled={repurposing} className="gap-2">
              <Repeat2 className="h-4 w-4" /> Repurpose
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCopy} className="gap-2">
              <Copy className="h-4 w-4" /> Copy text
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="gap-2 text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

const ContentEngine = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { activeWorkspace, workspaceVersion } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const [items, setItems] = useState<ContentItem[]>([]);
  const [hasBrandBrain, setHasBrandBrain] = useState<boolean | null>(null);
  const [repurposingId, setRepurposingId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<ContentItem | null>(null);
  const [publishItem, setPublishItem] = useState<ContentItem | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [counts, setCounts] = useState<Record<Tab, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [tab, setTab] = useState<Tab>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deletingBulk, setDeletingBulk] = useState(false);

  const mapContentItem = (item: Record<string, unknown>): ContentItem => {
    const preview = item.previewMedia as { mediaUrl?: string; mediaType?: string } | null | undefined;
    return {
      id: String(item.id),
      content: String(item.content ?? ''),
      content_type: String(item.contentType ?? ''),
      platforms: item.platforms as string[] | undefined,
      platformPayloads: item.platformPayloads as ContentItem['platformPayloads'],
      title: String(item.title ?? ''),
      campaign_theme: String(item.campaignTheme ?? ''),
      status: String(item.status ?? 'draft'),
      created_at: String(item.created_at ?? ''),
      scheduled_date: (item.scheduledDate as string | null) ?? null,
      scheduled_time: (item.scheduledTime as string | null) ?? null,
      publish_failed_reason: (item.publishFailedReason as string | null) ?? null,
      preview_url: preview?.mediaUrl ?? null,
      preview_type: preview?.mediaType ?? null,
      media_count: Number(item.mediaCount ?? 0),
    };
  };

  const loadContent = useCallback(async (opts?: { page?: number }) => {
    if (!user) return;
    const requestPage = opts?.page ?? page;
    setLoading(true);
    try {
      const result = await contentItemsApi.findPage({
        tenantId: tenant?.id,
        workspaceId: activeWorkspace ?? undefined,
        page: requestPage,
        limit: PAGE_SIZE,
        search: searchQuery || undefined,
        platform: platformFilter !== 'all' ? platformFilter : undefined,
        status: tab !== 'all' ? tab : undefined,
      });
      setItems((result.items ?? []).map(mapContentItem));
      setTotal(result.total ?? 0);
      setTotalPages(result.totalPages ?? 1);
      setCounts(result.statusCounts ?? null);
    } catch {
      setItems([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [user, tenant?.id, activeWorkspace, page, searchQuery, platformFilter, tab]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [searchQuery, platformFilter, tab, activeWorkspace]);

  useEffect(() => {
    setSelectedIds([]);
  }, [page]);

  // Switching workspace closes any open post. The first workspace to load is not a
  // switch, so a link that opens a post (?publish= or ?edit=) keeps it open.
  const lastWorkspaceRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!user) return;
    setPage(1);
    void checkBrandBrain();
    const previous = lastWorkspaceRef.current;
    lastWorkspaceRef.current = activeWorkspace;
    if (previous !== undefined && previous !== null && previous !== activeWorkspace) {
      setActiveItem(null);
      setPublishItem(null);
      setComposerOpen(false);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tenant?.id, activeWorkspace, workspaceVersion]);

  useEffect(() => {
    if (!user || !activeWorkspace) return;
    void loadContent();
  }, [page, loadContent, user, activeWorkspace]);

  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      TourService.autoStartTour('content_engine', contentEngineTourConfig.steps, undefined, contentEngineTourConfig.driverConfig);
    }, 500);
    return () => clearTimeout(timer);
  }, [user]);

  // Deep links: ?new=1 opens the composer, ?edit=<id> edits a post, ?publish=<id> opens publishing.
  useEffect(() => {
    const editId = searchParams.get('edit');
    const publishId = searchParams.get('publish');
    if (searchParams.get('new')) {
      setActiveItem(null);
      setComposerOpen(true);
      return;
    }
    if (!editId && !publishId) return;
    void (async () => {
      try {
        const data = await contentItemsApi.findOne((publishId ?? editId)!);
        if (!data) return;
        const mapped = mapContentItem(data);
        if (publishId) setPublishItem(mapped);
        else {
          setActiveItem(mapped);
          setComposerOpen(true);
        }
      } catch {
        /* the post no longer exists */
      }
    })();
  }, [searchParams]);

  const checkBrandBrain = async () => {
    if (!tenant || !activeWorkspace) return;
    try {
      const profile = await brandProfilesApi.getMine(tenant.id, activeWorkspace ?? undefined);
      setHasBrandBrain(isBrandVoiceStarted(profile));
    } catch {
      setHasBrandBrain(false);
    }
  };

  const openNew = () => {
    setActiveItem(null);
    setComposerOpen(true);
  };

  const openEdit = (item: ContentItem) => {
    setActiveItem(item);
    setComposerOpen(true);
    setSearchParams({ edit: item.id }, { replace: true });
  };

  const closeComposer = () => {
    setComposerOpen(false);
    setActiveItem(null);
    setSearchParams({}, { replace: true });
  };

  const openPublish = (item: ContentItem) => {
    setPublishItem(item);
    setSearchParams({ publish: item.id }, { replace: true });
  };

  const closePublish = () => {
    setPublishItem(null);
    setSearchParams({}, { replace: true });
  };

  const copyContent = async (item: ContentItem) => {
    try {
      await navigator.clipboard.writeText(plainText(item.content ?? ''));
      toast({ title: 'Copied', description: 'The post text is on your clipboard.' });
    } catch {
      toast({ title: "Couldn't copy", variant: 'destructive' });
    }
  };

  const deleteOne = async (item: ContentItem) => {
    const ok = await confirmModal(
      'It will be removed from your posts. Anything already published stays on the networks.',
      `Delete “${item.title || 'Untitled post'}”?`,
      'Delete',
    );
    if (!ok) return;
    try {
      await contentItemsApi.remove(item.id);
      toast({ title: 'Post deleted' });
      if (items.length === 1 && page > 1) setPage((p) => p - 1);
      else void loadContent();
      if (activeItem?.id === item.id) closeComposer();
      if (publishItem?.id === item.id) closePublish();
    } catch (err: unknown) {
      toast({ title: "Couldn't delete", description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    const n = selectedIds.length;
    const ok = await confirmModal(
      'They will be removed from your posts. Anything already published stays on the networks.',
      `Delete ${n} post${n === 1 ? '' : 's'}?`,
      'Delete',
    );
    if (!ok) return;
    setDeletingBulk(true);
    try {
      await contentItemsApi.bulkDelete(selectedIds);
      toast({ title: `${n} post${n === 1 ? '' : 's'} deleted` });
      setSelectedIds([]);
      void loadContent();
    } catch (err: unknown) {
      toast({ title: "Couldn't delete", description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setDeletingBulk(false);
    }
  };

  const handleRepurpose = async (id: string) => {
    setRepurposingId(id);
    try {
      const result = await queued(contentAiApi.repurpose(id));
      toast({ title: 'Repurposed', description: `${result?.repurposed ?? 0} new versions created.` });
      setTab('all');
      setPage(1);
      void loadContent({ page: 1 });
    } catch (err: unknown) {
      toast({ title: 'Repurpose failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setRepurposingId(null);
    }
  };

  const handleSaved = () => {
    closeComposer();
    setPage(1);
    void loadContent({ page: 1 });
  };

  const handlePublished = () => {
    void loadContent();
    closePublish();
  };

  const filtering = Boolean(searchQuery) || platformFilter !== 'all';
  const allOnPageSelected = items.length > 0 && items.every((c) => selectedIds.includes(c.id));
  const showingFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="w-full min-w-0 space-y-5 pb-10">
      {/* Header */}
      <div id="tour-ce-header" className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Posts</h1>
          <p className="text-sm text-muted-foreground">
            {counts ? `${counts.all} post${counts.all === 1 ? '' : 's'} in this workspace. ` : ''}
            Write, review and publish to every channel.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="hidden h-9 w-9 rounded-full lg:inline-flex"
            onClick={() => TourService.startTour('content_engine', contentEngineTourConfig.steps, undefined, contentEngineTourConfig.driverConfig)}
            aria-label="Take the tour"
            title="Take the tour"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
          <Button asChild variant="outline" className="h-10 gap-2 rounded-full">
            <Link to="/campaigns">
              <Megaphone className="h-4 w-4" /> AI campaign
            </Link>
          </Button>
          <Button id="tour-ce-controls" onClick={openNew} className="h-10 flex-1 gap-2 rounded-full sm:flex-none">
            <Plus className="h-4 w-4" /> New post
          </Button>
        </div>
      </div>

      {hasBrandBrain === false && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center">
          <Sparkles className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="flex-1 text-sm">
            <span className="font-medium">Posts will sound generic until you set up Brand voice.</span>{' '}
            <span className="text-muted-foreground">It takes a few minutes, and Mako can fill most of it from your website.</span>
          </p>
          <Button asChild size="sm" variant="outline" className="shrink-0 rounded-full">
            <Link to="/brand-brain">Set up Brand voice</Link>
          </Button>
        </div>
      )}

      <section id="tour-ce-results" className="overflow-hidden rounded-2xl border border-border/70 bg-card">
        {/* Status tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-border/60 px-2 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Filter posts by status">
          {TABS.map((t) => {
            const active = tab === t.id;
            const n = counts?.[t.id];
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={cn(
                  'relative flex shrink-0 items-center gap-1.5 rounded-t-lg px-3 pb-2.5 pt-2 text-sm transition-colors',
                  active ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
                  "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:content-['']",
                  active ? 'after:bg-primary' : 'after:bg-transparent',
                )}
              >
                {t.label}
                {n !== undefined && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-[11px] tabular-nums leading-5',
                      t.id === 'failed' && n > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Toolbar, or the bulk actions while posts are selected */}
        <div className="flex min-h-[60px] flex-col gap-2 border-b border-border/60 px-3 py-3 sm:flex-row sm:items-center sm:px-4">
          {selectedIds.length > 0 ? (
            <>
              <div className="flex flex-1 items-center gap-3">
                <Checkbox
                  checked={allOnPageSelected}
                  onCheckedChange={(v) => {
                    const pageIds = items.map((c) => c.id);
                    setSelectedIds((prev) =>
                      v ? [...new Set([...prev, ...pageIds])] : prev.filter((id) => !pageIds.includes(id)),
                    );
                  }}
                  aria-label="Select all on this page"
                />
                <span className="text-sm font-medium">{selectedIds.length} selected</span>
                <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => setSelectedIds([])}>
                  <X className="h-3.5 w-3.5" /> Clear
                </Button>
              </div>
              <Button type="button" variant="destructive" size="sm" className="h-8 gap-1.5 rounded-full text-xs" onClick={() => void handleBulkDelete()} disabled={deletingBulk}>
                {deletingBulk ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete selected
              </Button>
            </>
          ) : (
            <>
              <div className="relative flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search titles and text"
                  aria-label="Search posts"
                  className="h-9 rounded-full pl-9"
                />
              </div>
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="h-9 w-full rounded-full sm:w-[170px]" aria-label="Filter by channel">
                  <SelectValue placeholder="All channels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All channels</SelectItem>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filtering && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => {
                    setSearchInput('');
                    setPlatformFilter('all');
                  }}
                >
                  Clear filters
                </Button>
              )}
            </>
          )}
        </div>

        {/* List */}
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading posts…
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </span>
            {filtering || tab !== 'all' ? (
              <>
                <p className="mt-4 font-medium">No posts match</p>
                <p className="mt-1 text-sm text-muted-foreground">Try another tab, search or channel.</p>
              </>
            ) : (
              <>
                <p className="mt-4 font-medium">No posts yet</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Write your first post, or let Mako draft one in your Brand voice.
                </p>
                <Button onClick={openNew} className="mt-5 gap-2 rounded-full">
                  <Plus className="h-4 w-4" /> New post
                </Button>
              </>
            )}
          </div>
        ) : (
          <ul className={cn('divide-y divide-border/60 transition-opacity', loading && 'opacity-60')}>
            {items.map((item) => (
              <PostRow
                key={item.id}
                item={item}
                selected={selectedIds.includes(item.id)}
                onSelect={(v) => setSelectedIds((prev) => (v ? [...prev, item.id] : prev.filter((x) => x !== item.id)))}
                onEdit={() => openEdit(item)}
                onPublish={() => openPublish(item)}
                onRepurpose={() => void handleRepurpose(item.id)}
                onCopy={() => void copyContent(item)}
                onDelete={() => void deleteOne(item)}
                repurposing={repurposingId === item.id}
              />
            ))}
          </ul>
        )}

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-border/60 px-3 py-3 text-xs text-muted-foreground sm:px-4">
            <span>
              {showingFrom}–{showingTo} of {total}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous page">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                  .map((n, i, arr) => (
                    <span key={n} className="flex items-center">
                      {i > 0 && n - arr[i - 1] > 1 && <span className="px-1">…</span>}
                      <Button
                        type="button"
                        variant={n === page ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-8 min-w-8 rounded-full px-2 text-xs"
                        onClick={() => setPage(n)}
                        aria-current={n === page ? 'page' : undefined}
                      >
                        {n}
                      </Button>
                    </span>
                  ))}
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="Next page">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Compose / edit */}
      <Sheet open={composerOpen} onOpenChange={(open) => { if (!open) closeComposer(); }}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <SheetHeader className="shrink-0 border-b px-5 py-4 text-left sm:px-6">
            <SheetTitle className="font-display">{activeItem ? 'Edit post' : 'New post'}</SheetTitle>
            <SheetDescription>
              {activeItem ? 'Change the draft, then update it.' : 'Write it yourself, or give Mako a theme and let it draft one in your Brand voice.'}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {composerOpen && (
              <ContentEditor item={activeItem} workspaceId={activeWorkspace} onSaved={handleSaved} bare />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Publish */}
      <Sheet open={!!publishItem} onOpenChange={(open) => { if (!open) closePublish(); }}>
        <SheetContent side="right" className="flex w-full flex-col overflow-hidden p-0 sm:max-w-3xl lg:max-w-4xl xl:max-w-5xl">
          {publishItem && <PublishPanel item={publishItem} onCancel={closePublish} onPublished={handlePublished} />}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ContentEngine;
