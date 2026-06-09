import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWorkspace } from '@/hooks/useWorkspace';
import { sanitizeHtml } from '@/lib/sanitize';
import {
  Pen, Sparkles, Copy, Check, Trash2, Loader2, RefreshCw, Pencil,
  ChevronDown, ChevronUp, Plus, Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { brandProfilesApi, contentItemsApi } from '@/lib/api';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { platformOf } from '@/lib/platforms';
import { ContentItem } from '@/components/content/types';
import { ContentEditor } from '@/components/content/ContentEditor';
import { PublishPanel } from '@/components/content/PublishPanel';

type Panel = 'compose' | 'publish' | null;

function ContentCard({
  item,
  onCopy,
  onDelete,
  onEdit,
  onPublish,
  onRepurpose,
  copiedId,
  repurposingId,
}: {
  item: ContentItem;
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
    <div className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/30 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {item.title && <span className="text-sm font-semibold">{item.title}</span>}
          {item.status && (
            <Badge variant="secondary" className="text-[10px] capitalize">
              {item.status}
            </Badge>
          )}
          {platforms.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Published to {platforms.length} platform{platforms.length !== 1 ? 's' : ''}
            </span>
          )}
          {item.campaign_theme && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full border">
              {item.campaign_theme.replace(/<[^>]*>/g, '').slice(0, 28)}
            </span>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => onPublish(item)}>
            <Send className="h-3 w-3 mr-1" /> Publish
          </Button>
          {[
            { icon: Pencil, onClick: () => onEdit(item), title: 'Edit' },
            {
              icon: repurposingId === item.id ? Loader2 : RefreshCw,
              onClick: () => onRepurpose(item.id),
              title: 'Repurpose',
            },
            {
              icon: copiedId === item.id ? Check : Copy,
              onClick: () => onCopy(item.id, item.content ?? ''),
              title: 'Copy',
              color: copiedId === item.id ? 'text-green-600' : undefined,
            },
            { icon: Trash2, onClick: () => onDelete(item.id), title: 'Delete', color: 'text-destructive' },
          ].map(({ icon: I, onClick, title, color }, idx) => (
            <button
              key={idx}
              type="button"
              onClick={onClick}
              title={title}
              className={`w-7 h-7 rounded-md flex items-center justify-center hover:bg-muted ${color ?? 'text-muted-foreground'}`}
            >
              <I size={13} className={title === 'Repurpose' && repurposingId === item.id ? 'animate-spin' : ''} />
            </button>
          ))}
        </div>
      </div>

      {platforms.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {platforms.map((p) => {
            const plat = platformOf(p);
            const Icon = plat.icon;
            return (
              <span key={p} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Icon size={12} style={{ color: plat.color }} />
                {plat.label}
              </span>
            );
          })}
        </div>
      )}

      <div>
        <div
          className={`text-sm text-muted-foreground leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.content ?? '') }}
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-primary bg-transparent border-none cursor-pointer p-0 pt-1 flex items-center gap-1"
        >
          {expanded ? <><ChevronUp size={11} /> Show less</> : <><ChevronDown size={11} /> Show more</>}
        </button>
      </div>

      {item.created_at && (
        <p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p>
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
  const [panel, setPanel] = useState<Panel>(null);
  const [activeItem, setActiveItem] = useState<ContentItem | null>(null);
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
      const all = await contentItemsApi.findAll();
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

    async function loadItem(id: string, mode: Panel) {
      try {
        const data = await contentItemsApi.findOne(id);
        if (data) {
          setActiveItem(mapContentItem(data));
          setPanel(mode);
        }
      } catch {
        /* item missing */
      }
    }

    if (publishId) void loadItem(publishId, 'publish');
    else if (editId) void loadItem(editId, 'compose');
  }, [searchParams]);

  const clearParams = () => {
    setSearchParams({}, { replace: true });
    setPanel(null);
    setActiveItem(null);
  };

  const checkBrandBrain = async () => {
    if (!user || !tenant) return;
    try {
      const all = await brandProfilesApi.findAll();
      const list = Array.isArray(all) ? all : [];
      setHasBrandBrain(list.some(
        (p: Record<string, unknown>) => p.userId === user.id && p.tenantId === tenant.id,
      ));
    } catch {
      setHasBrandBrain(false);
    }
  };

  const openCreate = () => {
    setActiveItem(null);
    setPanel('compose');
    setSearchParams({}, { replace: true });
  };

  const openEdit = (item: ContentItem) => {
    setActiveItem(item);
    setPanel('compose');
    setSearchParams({ edit: item.id }, { replace: true });
  };

  const openPublish = (item: ContentItem) => {
    setActiveItem(item);
    setPanel('publish');
    setSearchParams({ publish: item.id }, { replace: true });
  };

  const copyContent = (id: string, content: string) => {
    navigator.clipboard.writeText(content.replace(/<[^>]*>/g, ''));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const deleteContent = async (id: string) => {
    await contentItemsApi.remove(id);
    setGeneratedContent((prev) => prev.filter((c) => c.id !== id));
    if (activeItem?.id === id) clearParams();
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
    clearParams();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center">
            <Pen size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display tracking-tight">Content Engine</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Create content, publish to any platform when ready</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {workspaces.length > 0 && (
            <Select value={activeWorkspace || ''} onValueChange={setActiveWorkspace}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Workspace…" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <span className={`text-xs px-3 py-1 rounded-full border font-medium ${
            hasBrandBrain === true ? 'bg-green-500/10 text-green-700 border-green-500/30' :
            hasBrandBrain === false ? 'bg-amber-500/10 text-amber-700 border-amber-500/30' :
            'bg-muted text-muted-foreground'
          }`}>
            {hasBrandBrain === null ? 'Checking…' : hasBrandBrain ? 'Brand Brain active' : 'No Brand Brain'}
          </span>
          {!panel && (
            <Button onClick={openCreate} className="gradient-primary text-primary-foreground border-0 shadow-glow">
              <Plus className="h-4 w-4 mr-2" />
              Create content
            </Button>
          )}
        </div>
      </div>

      {hasBrandBrain === false && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
          <Sparkles size={15} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm">
            <strong className="text-amber-600">Set up Brand Brain</strong> — the AI uses it to match your brand voice.
          </p>
        </div>
      )}

      {panel === 'compose' && (
        <ContentEditor
          item={activeItem}
          workspaceId={activeWorkspace}
          onCancel={clearParams}
          onSaved={handleSaved}
        />
      )}

      {panel === 'publish' && activeItem && (
        <PublishPanel
          item={activeItem}
          onCancel={clearParams}
          onPublished={handleSaved}
        />
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold">Content Library</span>
          <span className="text-xs text-muted-foreground">
            {generatedContent.length} item{generatedContent.length !== 1 ? 's' : ''}
          </span>
        </div>

        {generatedContent.length === 0 && !panel ? (
          <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground text-sm">
            No content yet — click <strong>Create content</strong> to get started.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {generatedContent.map((item) => (
              <ContentCard
                key={item.id}
                item={item}
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
  );
};

export default ContentEngine;
