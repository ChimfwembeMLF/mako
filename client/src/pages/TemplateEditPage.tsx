import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTenant } from '@/hooks/useTenant';
import { useWorkspace } from '@/hooks/useWorkspace';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/lib/permissions';
import { templatesApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { PermissionGate } from '@/components/PermissionGate';
import { templatePlatforms } from '@/lib/platform-capabilities';
import { ArrowLeft, ImagePlus, Loader2, X } from 'lucide-react';
import { usePageBreadcrumb } from '@/hooks/usePageBreadcrumb';
import { MediaPicker } from '@/components/MediaPicker';
import { CHANNEL_RULES, CHANNEL_SWATCH } from '@/components/templates/channels';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { cn } from '@/lib/utils';

const TEMPLATE_PLATFORM_LIST = templatePlatforms();
const PLATFORM_LABELS: Record<string, string> = Object.fromEntries(
  TEMPLATE_PLATFORM_LIST.map((p) => [p.id, p.label]),
);

const MAX_MEDIA = 4;

interface TemplateForm {
  name: string;
  description: string;
  contentType: string;
  platform: string;
  body: string;
  mediaUrls: string[];
  isActive: boolean;
}

export default function TemplateEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const { activeWorkspace, workspaceVersion } = useWorkspace();
  const { can } = usePermissions();
  const { toast } = useToast();
  const isNew = id === 'new';

  const [form, setForm] = useState<TemplateForm>({
    name: '',
    description: '',
    contentType: 'social',
    platform: 'facebook',
    body: '',
    mediaUrls: [],
    isActive: true,
  });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [pickingMedia, setPickingMedia] = useState(false);
  const [dirty, setDirty] = useState(false);

  usePageBreadcrumb(isNew ? 'New template' : form.name || undefined);

  useEffect(() => {
    if (!isNew && id && tenant && activeWorkspace) loadTemplate(id, tenant.id);
  }, [id, tenant?.id, isNew, activeWorkspace, workspaceVersion]);

  async function loadTemplate(templateId: string, tenantId: string) {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const row = await templatesApi.findOne(templateId, tenantId, activeWorkspace);
      const platform = row.platforms?.[0] ?? row.contentType ?? 'content';
      setForm({
        name: row.name ?? '',
        description: row.description ?? '',
        contentType: row.contentType ?? 'social',
        platform,
        body: row.body ?? '',
        mediaUrls: row.mediaUrls ?? [],
        isActive: row.isActive ?? true,
      });
    } catch (e: unknown) {
      toast({
        title: 'Failed to load template',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  const set = <K extends keyof TemplateForm>(k: K, v: TemplateForm[K]) => {
    setDirty(true);
    setForm((f) => ({ ...f, [k]: v }));
  };

  function chooseChannel(v: string) {
    set('platform', v);
    set('contentType', v === 'content' ? 'content' : v === 'email' || v === 'ad_copy' ? v : 'social');
  }

  async function handleSave() {
    if (!form.name.trim() || !tenant || !activeWorkspace) return;
    setSaving(true);
    try {
      const payload = {
        tenantId: tenant.id,
        workspaceId: activeWorkspace,
        name: form.name.trim(),
        description: form.description.trim() || null,
        contentType: form.contentType,
        body: form.body.trim(),
        mediaUrls: form.mediaUrls,
        platforms: [form.platform],
        isActive: form.isActive,
      };

      if (isNew) {
        const created = await templatesApi.create(payload);
        toast({ title: 'Template created' });
        if (created?.id) navigate(`/templates/${created.id}`);
        else navigate('/templates');
      } else if (id) {
        await templatesApi.update(id, tenant.id, payload, activeWorkspace);
        setDirty(false);
        toast({ title: 'Template saved' });
      }
    } catch (e: unknown) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  const requirePerm = isNew ? P.templates.create : P.templates.edit;
  const canSave = Boolean(form.name.trim() && form.body.trim()) && !saving;
  const rules = CHANNEL_RULES[form.platform] ?? [];
  const label = PLATFORM_LABELS[form.platform] ?? form.platform;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading template…
      </div>
    );
  }

  const saveButton = (
    <Button onClick={() => void handleSave()} disabled={!canSave} className="gap-1.5">
      {saving && <Loader2 className="h-4 w-4 animate-spin" />}
      {saving ? 'Saving…' : isNew ? 'Create template' : 'Save changes'}
    </Button>
  );

  return (
    <PermissionGate require={requirePerm} fallback={true}>
      <div className="w-full min-w-0 pb-24 lg:pb-10">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <Link to="/templates" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Templates
            </Link>
            <h1 className="mt-2 truncate font-display text-2xl font-semibold sm:text-3xl">
              {isNew ? 'New template' : form.name || 'Untitled template'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isNew ? 'Tell AI how to write for one channel.' : dirty ? 'You have unsaved changes.' : 'All changes saved.'}
            </p>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <Button variant="ghost" asChild>
              <Link to="/templates">Cancel</Link>
            </Button>
            {saveButton}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6 rounded-2xl border bg-card p-5 sm:p-6">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Facebook product launch"
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Channel</legend>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_PLATFORM_LIST.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => chooseChannel(p.id)}
                    aria-pressed={form.platform === p.id}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      form.platform === p.id ? 'border-foreground bg-foreground text-background' : 'hover:bg-muted',
                    )}
                  >
                    <span className={cn('h-2 w-2 rounded-sm', CHANNEL_SWATCH[p.id] ?? 'bg-muted-foreground')} aria-hidden />
                    {p.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="space-y-1.5">
              <Label htmlFor="desc">What it’s for <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input
                id="desc"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="e.g. Launch posts that end with a question"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor="prompt">Instructions for AI</Label>
                <span className="text-xs tabular-nums text-muted-foreground">{form.body.length.toLocaleString()} characters</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Structure, tone, length, emojis and hashtags. AI reads this every time it writes for {label}.
              </p>
              <textarea
                id="prompt"
                rows={14}
                value={form.body}
                onChange={(e) => set('body', e.target.value)}
                placeholder={`Write for ${label}.\nStructure: hook (1 line) → short story → question to drive comments.\nTone: warm and conversational.\nLength: 150–300 words.`}
                className="mt-1 w-full resize-y rounded-xl border bg-background p-4 font-mono text-[13px] leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <aside className="space-y-4">
            {rules.length > 0 && (
              <section className="rounded-2xl border bg-card p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <span className={cn('h-2 w-2 rounded-sm', CHANNEL_SWATCH[form.platform] ?? 'bg-muted-foreground')} aria-hidden />
                  {label} rules
                </h2>
                <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                  {rules.map((r) => (
                    <li key={r} className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />{r}</li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] text-muted-foreground/80">AI keeps to these even if your instructions don’t mention them.</p>
              </section>
            )}

            {can(P.templates.activate) && (
              <section className="flex items-start justify-between gap-4 rounded-2xl border bg-card p-5">
                <div>
                  <h2 className="text-sm font-semibold">Use this template</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    When on, it’s available when writing. The most recently edited active template for {label} is used by default.
                  </p>
                </div>
                <Switch checked={form.isActive} onCheckedChange={(v) => set('isActive', v)} aria-label="Use this template" />
              </section>
            )}

            <section className="rounded-2xl border bg-card p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold">Media</h2>
                <span className="text-xs tabular-nums text-muted-foreground">{form.mediaUrls.length}/{MAX_MEDIA}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Attached to every post written with this template.</p>
              {form.mediaUrls.length > 0 && (
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {form.mediaUrls.map((url, i) => (
                    <div key={`${url}-${i}`} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
                      {/\.(mp4|webm|mov)/i.test(url) ? (
                        <video src={resolveMediaUrl(url)} className="h-full w-full object-cover" muted />
                      ) : (
                        <img src={resolveMediaUrl(url)} alt="" className="h-full w-full object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => set('mediaUrls', form.mediaUrls.filter((_, j) => j !== i))}
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                        aria-label="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {form.mediaUrls.length < MAX_MEDIA && !pickingMedia && (
                <Button variant="outline" size="sm" className="mt-3 w-full gap-1.5" onClick={() => setPickingMedia(true)}>
                  <ImagePlus className="h-3.5 w-3.5" /> Add media
                </Button>
              )}
            </section>
          </aside>
        </div>

        {pickingMedia && (
          <section className="mt-6 rounded-2xl border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Add media</h2>
              <Button variant="ghost" size="sm" onClick={() => setPickingMedia(false)}>Done</Button>
            </div>
            <MediaPicker
              value=""
              onChange={(url) => {
                if (!url) return;
                const next = [...form.mediaUrls, url].slice(0, MAX_MEDIA);
                set('mediaUrls', next);
                if (next.length >= MAX_MEDIA) setPickingMedia(false);
              }}
            />
          </section>
        )}

        {/* Phones: keep Save in reach. */}
        <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t bg-background/95 p-3 backdrop-blur sm:hidden">
          <Button variant="outline" asChild className="flex-1">
            <Link to="/templates">Cancel</Link>
          </Button>
          <div className="flex-[2] [&>button]:w-full">{saveButton}</div>
        </div>
      </div>
    </PermissionGate>
  );
}
