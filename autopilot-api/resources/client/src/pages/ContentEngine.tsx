import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  Pen, Sparkles, Copy, Check, Trash2, Loader2, RefreshCw, Pencil,
  ChevronDown, ChevronUp, Send, Eye, Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { brandProfilesApi, contentItemsApi } from '@/lib/api';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { PLATFORMS, platformOf } from '@/lib/platforms';
import { ContentItem } from '@/components/content/types';
import { ContentEditor } from '@/components/content/ContentEditor';
import { PublishPanel } from '@/components/content/PublishPanel';

const PAGE_SIZE = 6;

function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function ContentCard({
  item,
  isActive,
  onCopy,
  onDelete,
  onEdit,
  onPublish,
  onRepurpose,
  copiedId,
  repurposingId,
}: {
  item: ContentItem;
  isActive?: boolean;
  onCopy: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onEdit: (item: ContentItem) => void;
  onPublish: (item: ContentItem) => void;
  onRepurpose: (id: string) => void;
  copiedId: string | null;
  repurposingId: string | null;
}) {
  const platforms = item.platforms?.length ? item.platforms : [];
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-xl border bg-card p-3 sm:p-4 transition-all flex flex-col gap-3 min-w-0 ${
        isActive ? 'border-primary ring-2 ring-primary/20 shadow-sm' : 'hover:border-primary/30'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            {item.title && <span className="text-sm font-semibold break-words">{item.title}</span>}
            {isActive && (
              <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                Editing
              </Badge>
            )}
            {item.status && (
              <Badge variant="secondary" className="text-[10px] capitalize">
                {item.status}
              </Badge>
            )}
          </div>
          {item.campaign_theme && (
            <p className="text-xs text-muted-foreground line-clamp-2 sm:line-clamp-1">
              {plainText(item.campaign_theme)}
            </p>
          )}
        </div>
        <div className="flex gap-1.5 shrink-0 self-stretch sm:self-auto">
          <Button type="button" size="sm" variant="outline" className="h-8 flex-1 sm:flex-none text-xs" asChild>
            <Link to={`/content/${item.id}`}>
              <Eye className="h-3 w-3 mr-1" />
              Details
            </Link>
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8 flex-1 sm:flex-none text-xs" onClick={() => onPublish(item)}>
            <Send className="h-3 w-3 mr-1" />
            Publish
          </Button>
          {/* <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(item)} title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => onRepurpose(item.id)}
            title="Repurpose"
            disabled={repurposingId === item.id}
          >
            {repurposingId === item.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button> */}
          {/* <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => onCopy(item.id, item.content ?? '')}
            title="Copy"
          >
            {copiedId === item.id ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button> */}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onDelete(item.id)}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {platforms.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {platforms.map((p) => {
            const plat = platformOf(p);
            const Icon = plat.icon;
            return (
              <span
                key={p}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full"
              >
                <Icon size={11} style={{ color: plat.color }} />
                {plat.label}
              </span>
            );
          })}
        </div>
      )}

      <div>
        <p
          className={`text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap ${expanded ? '' : 'line-clamp-2'}`}
        >
          {plainText(item.content ?? '')}
        </p>
        {(item.content?.length ?? 0) > 120 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-primary mt-1 flex items-center gap-1 hover:underline"
          >
            {expanded ? <><ChevronUp size={11} /> Show less</> : <><ChevronDown size={11} /> Show more</>}
          </button>
        )}
      </div>

      {item.created_at && (
        <p className="text-[11px] text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p>
      )}
    </div>
  );
}

const ContentEngine = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { activeWorkspace, workspaceVersion } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const [generatedContent, setGeneratedContent] = useState<ContentItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hasBrandBrain, setHasBrandBrain] = useState<boolean | null>(null);
  const [repurposingId, setRepurposingId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<ContentItem | null>(null);
  const [publishItem, setPublishItem] = useState<ContentItem | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingContent, setLoadingContent] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const { toast } = useToast();

  const mapContentItem = (item: Record<string, unknown>): ContentItem => ({
    id: String(item.id),
    content: String(item.content ?? ''),
    content_type: String(item.contentType ?? ''),
    platforms: item.platforms as string[] | undefined,
    platformPayloads: item.platformPayloads as ContentItem['platformPayloads'],
    title: String(item.title ?? ''),
    campaign_theme: String(item.campaignTheme ?? ''),
    status: String(item.status ?? 'draft'),
    created_at: String(item.created_at ?? ''),
  });

  const loadContent = useCallback(async (opts?: { page?: number }) => {
    if (!user) return;
    const requestPage = opts?.page ?? page;
    setLoadingContent(true);
    try {
      const result = await contentItemsApi.findPage({
        tenantId: tenant?.id,
        workspaceId: activeWorkspace ?? undefined,
        page: requestPage,
        limit: PAGE_SIZE,
        search: searchQuery || undefined,
        platform: platformFilter !== 'all' ? platformFilter : undefined,
      });
      setGeneratedContent((result.items ?? []).map(mapContentItem));
      setTotal(result.total ?? 0);
      setTotalPages(result.totalPages ?? 1);
    } catch {
      setGeneratedContent([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoadingContent(false);
    }
  }, [user, tenant?.id, activeWorkspace, page, searchQuery, platformFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, platformFilter, activeWorkspace]);

  useEffect(() => {
    if (!user) return;
    setPage(1);
    setActiveItem(null);
    setPublishItem(null);
    setSearchParams({}, { replace: true });
    void checkBrandBrain();
  }, [user, tenant?.id, activeWorkspace, workspaceVersion]);

  useEffect(() => {
    if (!user || !activeWorkspace) return;
    void loadContent();
  }, [page, loadContent, user, activeWorkspace]);

  useEffect(() => {
    const editId = searchParams.get('edit');
    const publishId = searchParams.get('publish');
    if (!editId && !publishId) return;

    async function loadItem(id: string, mode: 'edit' | 'publish') {
      try {
        const data = await contentItemsApi.findOne(id);
        if (data) {
          const mapped = mapContentItem(data);
          if (mode === 'publish') setPublishItem(mapped);
          else setActiveItem(mapped);
        }
      } catch {
        /* item missing */
      }
    }

    if (publishId) void loadItem(publishId, 'publish');
    else if (editId) void loadItem(editId, 'edit');
  }, [searchParams]);

  const resetDraft = () => {
    setActiveItem(null);
    setSearchParams({}, { replace: true });
  };

  const closePublish = () => {
    setPublishItem(null);
    setSearchParams({}, { replace: true });
  };

  const checkBrandBrain = async () => {
    if (!tenant) return;
    try {
      const profile = await brandProfilesApi.getMine(tenant.id, activeWorkspace ?? undefined);
      setHasBrandBrain(Boolean(profile?.companyName || profile?.description));
    } catch {
      setHasBrandBrain(false);
    }
  };

  const openEdit = (item: ContentItem) => {
    setActiveItem(item);
    setSearchParams({ edit: item.id }, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openPublish = (item: ContentItem) => {
    setPublishItem(item);
    setSearchParams({ publish: item.id }, { replace: true });
  };

  const copyContent = (id: string, content: string) => {
    navigator.clipboard.writeText(plainText(content));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const deleteContent = async (id: string) => {
    await contentItemsApi.remove(id);
    if (generatedContent.length === 1 && page > 1) {
      setPage((p) => p - 1);
    } else {
      void loadContent();
    }
    if (activeItem?.id === id) resetDraft();
    if (publishItem?.id === id) closePublish();
  };

  const handleRepurpose = async (id: string) => {
    setRepurposingId(id);
    try {
      const { data, error } = await invokeEdgeFunction('repurpose-content', { body: { contentId: id } });
      if (error) throw error;
      const result = data as { error?: string; repurposed?: number } | null;
      if (result?.error) throw new Error(result.error);
      toast({ title: 'Repurposed!', description: `${result?.repurposed ?? 0} new versions created.` });
      setPage(1);
      void loadContent({ page: 1 });
    } catch (err: unknown) {
      toast({
        title: 'Repurpose failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setRepurposingId(null);
    }
  };

  const handleSaved = () => {
    setPage(1);
    void loadContent({ page: 1 });
    resetDraft();
  };

  const handlePublished = () => {
    void loadContent();
    closePublish();
  };

  const showingFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="w-full space-y-5 sm:space-y-6 pb-8 sm:pb-10 min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
            <Pen size={18} className="text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold font-display tracking-tight">Content Engine</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Create, refine, and publish across platforms</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link to="/campaigns">AI Campaigns</Link>
          </Button>
          <span className={`text-xs px-3 py-1.5 rounded-full border font-medium whitespace-nowrap ${
            hasBrandBrain === true ? 'bg-green-500/10 text-green-700 border-green-500/30' :
            hasBrandBrain === false ? 'bg-amber-500/10 text-amber-700 border-amber-500/30' :
            'bg-muted text-muted-foreground'
          }`}>
            {hasBrandBrain === null ? 'Checking…' : hasBrandBrain ? 'Brand Brain active' : 'No Brand Brain'}
          </span>
        </div>
      </div>

      {hasBrandBrain === false && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start sm:items-center gap-3">
          <Sparkles size={15} className="text-amber-500 shrink-0 mt-0.5 sm:mt-0" />
          <p className="text-sm leading-relaxed">
            <strong className="text-amber-600">Set up Brand Brain</strong> — the AI uses it to match your brand voice.
          </p>
        </div>
      )}

      {/* Main layout: compose always visible + library */}
      <div className="grid gap-5 sm:gap-6 lg:grid-cols-5 lg:items-start">
        <div className="lg:col-span-2 lg:sticky lg:top-4 min-w-0">
          <ContentEditor
            item={activeItem}
            workspaceId={activeWorkspace}
            onReset={resetDraft}
            onSaved={handleSaved}
          />
        </div>

        <div className="lg:col-span-3 space-y-3 min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">Content library</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {total === 0
                  ? 'No items'
                  : `Showing ${showingFrom}–${showingTo} of ${total}`}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search by title…"
                  className="h-9 pl-8"
                />
              </div>
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="h-9 w-full sm:w-[160px]">
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All platforms</SelectItem>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loadingContent ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading content…
            </div>
          ) : generatedContent.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/20 p-10 text-center">
              <p className="text-sm text-muted-foreground">
                {searchQuery || platformFilter !== 'all'
                  ? 'No content matches your filters.'
                  : 'No saved drafts yet.'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery || platformFilter !== 'all'
                  ? 'Try a different title or platform.'
                  : (
                    <>
                      <span className="lg:hidden">Compose above and hit Save draft.</span>
                      <span className="hidden lg:inline">Compose on the left and hit Save draft.</span>
                    </>
                  )}
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {generatedContent.map((item) => (
                  <ContentCard
                    key={item.id}
                    item={item}
                    isActive={activeItem?.id === item.id}
                    onCopy={copyContent}
                    onDelete={deleteContent}
                    onEdit={openEdit}
                    onPublish={openPublish}
                    onRepurpose={handleRepurpose}
                    copiedId={copiedId}
                    repurposingId={repurposingId}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-none"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-none"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                  <span className="text-xs text-muted-foreground text-center sm:text-left">
                    Page {page} of {totalPages}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Publish sheet */}
      <Sheet open={!!publishItem} onOpenChange={(open) => { if (!open) closePublish(); }}>
        <SheetContent side="right" className="w-full sm:max-w-3xl lg:max-w-4xl xl:max-w-5xl p-0 flex flex-col overflow-hidden">
          {publishItem && (
            <PublishPanel
              item={publishItem}
              onCancel={closePublish}
              onPublished={handlePublished}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ContentEngine;
