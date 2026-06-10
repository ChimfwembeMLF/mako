import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  Pen, Sparkles, Copy, Check, Trash2, Loader2, RefreshCw, Pencil,
  ChevronDown, ChevronUp, Send, Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { brandProfilesApi, contentItemsApi } from '@/lib/api';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { platformOf } from '@/lib/platforms';
import { ContentItem } from '@/components/content/types';
import { ContentEditor } from '@/components/content/ContentEditor';
import { PublishPanel } from '@/components/content/PublishPanel';

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
      className={`rounded-xl border bg-card p-4 transition-all flex flex-col gap-3 ${
        isActive ? 'border-primary ring-2 ring-primary/20 shadow-sm' : 'hover:border-primary/30'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            {item.title && <span className="text-sm font-semibold truncate">{item.title}</span>}
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
            <p className="text-xs text-muted-foreground line-clamp-1">
              {plainText(item.campaign_theme)}
            </p>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" asChild>
            <Link to={`/content/${item.id}`}>
              <Eye className="h-3 w-3 mr-1" /> Details
            </Link>
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => onPublish(item)}>
            <Send className="h-3 w-3 mr-1" /> Publish
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(item)} title="Edit">
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
          </Button>
          <Button
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
          </Button>
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
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspace(user?.id);
  const [searchParams, setSearchParams] = useSearchParams();
  const [generatedContent, setGeneratedContent] = useState<ContentItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hasBrandBrain, setHasBrandBrain] = useState<boolean | null>(null);
  const [repurposingId, setRepurposingId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<ContentItem | null>(null);
  const [publishItem, setPublishItem] = useState<ContentItem | null>(null);
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

  const loadContent = async () => {
    if (!user) return;
    try {
      const all = await contentItemsApi.findAll(tenant?.id);
      const list = (Array.isArray(all) ? all : [])
        .filter((item: Record<string, unknown>) =>
          item.userId === user.id && (!tenant?.id || item.tenantId === tenant.id),
        )
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .slice(0, 30);
      setGeneratedContent(list.map(mapContentItem));
    } catch {
      setGeneratedContent([]);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadContent();
    checkBrandBrain();
  }, [user, tenant?.id]);

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
      const profile = await brandProfilesApi.getMine(tenant.id);
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
    setGeneratedContent((prev) => prev.filter((c) => c.id !== id));
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
      loadContent();
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
    loadContent();
    resetDraft();
  };

  const handlePublished = () => {
    loadContent();
    closePublish();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
            <Pen size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display tracking-tight">Content Engine</h1>
            <p className="text-sm text-muted-foreground">Create, refine, and publish across platforms</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link to="/campaigns">AI Campaigns</Link>
          </Button>
          {workspaces.length > 0 && (
            <Select value={activeWorkspace || ''} onValueChange={setActiveWorkspace}>
              <SelectTrigger className="w-full sm:w-[180px] h-9">
                <SelectValue placeholder="Workspace…" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
          <Sparkles size={15} className="text-amber-500 shrink-0" />
          <p className="text-sm">
            <strong className="text-amber-600">Set up Brand Brain</strong> — the AI uses it to match your brand voice.
          </p>
        </div>
      )}

      {/* Main layout: compose always visible + library */}
      <div className="grid gap-6 lg:grid-cols-5 lg:items-start">
        <div className="lg:col-span-2 lg:sticky lg:top-4">
          <ContentEditor
            item={activeItem}
            workspaceId={activeWorkspace}
            onReset={resetDraft}
            onSaved={handleSaved}
          />
        </div>

        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Content library</h2>
            <span className="text-xs text-muted-foreground">
              {generatedContent.length} item{generatedContent.length !== 1 ? 's' : ''}
            </span>
          </div>

          {generatedContent.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/20 p-10 text-center">
              <p className="text-sm text-muted-foreground">No saved drafts yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Compose on the left and hit Save draft.</p>
            </div>
          ) : (
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
