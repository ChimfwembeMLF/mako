import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTenant } from '@/hooks/useTenant';
import { useWorkspace } from '@/hooks/useWorkspace';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/lib/permissions';
import { templatesApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { PermissionGate } from '@/components/PermissionGate';
import { templatePlatforms } from '@/lib/platform-capabilities';
import { ArrowLeft, Save, LayoutTemplate, Loader2 } from 'lucide-react';

const TEMPLATE_PLATFORM_LIST = templatePlatforms();
const PLATFORM_LABELS: Record<string, string> = Object.fromEntries(
  TEMPLATE_PLATFORM_LIST.map((p) => [p.id, p.label]),
);

const PLATFORM_HINTS: Record<string, string> = {
  facebook: 'Max 63,206 chars. 5 hashtags max. Use hook → body → CTA structure.',
  linkedin: 'Max 3,000 chars. Professional tone. 3-5 hashtags at end.',
  instagram: 'Max 2,200 chars. 30 hashtags max — place at end.',
  twitter: 'STRICT 280 char limit. 1-2 hashtags only.',
  whatsapp: 'Conversational. No markdown. Max ~300 words.',
  email: 'Subject ≤ 60 chars. Preheader ≤ 90 chars. One CTA.',
  ad_copy: 'Headline ≤ 40 chars. Primary ≤ 125 chars. One CTA verb.',
  content: 'HTML allowed: <p>, <ul>, <li>, <strong>.',
};

interface TemplateForm {
  name: string;
  description: string;
  contentType: string;
  platform: string;
  body: string;
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
    isActive: true,
  });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

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

  const set = <K extends keyof TemplateForm>(k: K, v: TemplateForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading template…
      </div>
    );
  }

  return (
    <PermissionGate require={requirePerm} fallback={true}>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/templates">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <LayoutTemplate className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">{isNew ? 'New Template' : 'Edit Template'}</h1>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="name">
                Template name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Facebook Product Launch"
              />
            </div>
            <div className="space-y-1">
              <Label>Platform</Label>
              <Select
                value={form.platform}
                onValueChange={(v) => {
                  set('platform', v);
                  if (v === 'content' || v === 'email' || v === 'ad_copy') {
                    set('contentType', v === 'content' ? 'content' : v);
                  } else {
                    set('contentType', 'social');
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_PLATFORM_LIST.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="desc">Description</Label>
            <Input
              id="desc"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="What is this template optimised for?"
            />
          </div>

          {form.platform && (
            <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-xs text-blue-700 dark:text-blue-300">
              <strong>Platform rules for {PLATFORM_LABELS[form.platform]}:</strong>
              <br />
              {PLATFORM_HINTS[form.platform]}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="prompt">
              AI prompt instructions <span className="text-destructive">*</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              Injected into AI system prompts when generating or adapting content for this platform.
            </p>
            <Textarea
              id="prompt"
              rows={10}
              value={form.body}
              onChange={(e) => set('body', e.target.value)}
              placeholder={`Write for ${PLATFORM_LABELS[form.platform] ?? 'this platform'}…`}
              className="font-mono text-sm resize-y"
            />
            <p className="text-xs text-muted-foreground text-right">{form.body.length} chars</p>
          </div>

          {can(P.templates.activate) && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">
                  Active templates are used automatically during AI generation.
                </p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={(v) => set('isActive', v)} />
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" asChild>
              <Link to="/templates">Cancel</Link>
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.body.trim()} className="gap-1">
              <Save className="h-4 w-4" />
              {saving ? 'Saving…' : isNew ? 'Create Template' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </PermissionGate>
  );
}
