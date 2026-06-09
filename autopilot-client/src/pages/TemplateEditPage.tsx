import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTenant } from '@/hooks/useTenant';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { PermissionGate } from '@/components/PermissionGate';
import { ArrowLeft, Save, LayoutTemplate } from 'lucide-react';

const PLATFORMS = ['facebook','linkedin','instagram','twitter','whatsapp','email','ad_copy'] as const;
const PLATFORM_LABELS: Record<string, string> = {
  facebook:'Facebook', linkedin:'LinkedIn', instagram:'Instagram', twitter:'X / Twitter',
  whatsapp:'WhatsApp', email:'Email', ad_copy:'Ad Copy',
};

const PLATFORM_HINTS: Record<string, string> = {
  facebook:  'Max 63,206 chars. 5 hashtags max. Use hook → body → CTA structure.',
  linkedin:  'Max 3,000 chars. Professional tone. 3-5 hashtags at end. No excessive emoji.',
  instagram: 'Max 2,200 chars. 30 hashtags max — place at end. Lead with visual description.',
  twitter:   'STRICT 280 char limit. 1-2 hashtags only. One idea per tweet.',
  whatsapp:  'Conversational. No markdown. Max ~300 words. Feel human, not mass-blast.',
  email:     'Subject ≤ 60 chars. Preheader ≤ 90 chars. One CTA. No spam words.',
  ad_copy:   'Headline ≤ 40 chars. Primary ≤ 125 chars. Lead with pain point. One CTA verb.',
};

interface Template {
  id: string; tenant_id: string | null; platform: string; name: string;
  description: string | null; prompt_instructions: string;
  is_active: boolean; is_system: boolean; structure: Record<string, unknown>;
}

export default function TemplateEditPage() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const { tenant } = useTenant();
  const { can }    = usePermissions();
  const { toast }  = useToast();
  const isNew      = id === 'new';

  const [form, setForm] = useState<Omit<Template,'id'|'is_system'>>({
    tenant_id: null, platform: 'facebook', name: '', description: '',
    prompt_instructions: '', is_active: false, structure: {},
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tenant) {
      setForm(f => ({ ...f, tenant_id: tenant.id }));
    }
  }, [id, tenant]);

  const set = (k: keyof typeof form, v: any) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.name.trim() || !tenant) return;
    setSaving(true);
    toast({
      title: 'Coming soon',
      description: 'Content templates are not available yet.',
    });
    setSaving(false);
  }

  const requirePerm = isNew ? P.templates.create : P.templates.edit;

  return (
    <PermissionGate require={requirePerm} fallback={true}>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/templates"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4"/></Button></Link>
          <LayoutTemplate className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">{isNew ? 'New Template' : 'Edit Template'}</h1>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="name">Template name <span className="text-destructive">*</span></Label>
              <Input id="name" value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="e.g. Facebook Product Launch" />
            </div>
            <div className="space-y-1">
              <Label>Platform <span className="text-destructive">*</span></Label>
              <Select value={form.platform} onValueChange={v => set('platform', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map(p => <SelectItem key={p} value={p}>{PLATFORM_LABELS[p]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="desc">Description</Label>
            <Input id="desc" value={form.description ?? ''} onChange={e => set('description', e.target.value)}
              placeholder="What is this template optimised for?" />
          </div>

          {/* Platform rules hint */}
          {form.platform && (
            <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-xs text-blue-700 dark:text-blue-300">
              <strong>Platform rules for {PLATFORM_LABELS[form.platform]}:</strong><br/>
              {PLATFORM_HINTS[form.platform]}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="prompt">AI Prompt Instructions <span className="text-destructive">*</span></Label>
            <p className="text-xs text-muted-foreground">
              These instructions are injected verbatim into the AI system prompt when generating content for this platform.
              Be specific about format, length, tone, and platform constraints.
            </p>
            <Textarea
              id="prompt" rows={10} value={form.prompt_instructions}
              onChange={e => set('prompt_instructions', e.target.value)}
              placeholder={`Write for ${PLATFORM_LABELS[form.platform] ?? 'this platform'}. Include: tone, length limit, structure, hashtag rules, CTA style…`}
              className="font-mono text-sm resize-y"
            />
            <p className="text-xs text-muted-foreground text-right">{form.prompt_instructions.length} chars</p>
          </div>

          <Separator />

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" asChild><Link to="/templates">Cancel</Link></Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="gap-1">
              <Save className="h-4 w-4"/>
              {saving ? 'Saving…' : isNew ? 'Create Template' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </PermissionGate>
  );
}
