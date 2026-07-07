import { useState, useEffect, useCallback } from 'react';
import {
  Plus, RefreshCw, Send, Trash2, Pencil, Download,
  CheckCircle2, Clock, XCircle, PauseCircle, FileText,
  ChevronRight, ChevronLeft, Eye, MessageCircle, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { useWorkspace } from '@/hooks/useWorkspace';
import { whatsappTemplatesApi } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type TemplateStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED';
type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

interface TemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phone_number?: string;
}

interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  buttons?: TemplateButton[];
}

interface TemplateVariable {
  key: string;
  position: number;
  component: 'HEADER' | 'BODY';
  example?: string;
}

interface WaTemplate {
  id: string;
  tenantId: string;
  name: string;
  language: string;
  category: TemplateCategory;
  status: TemplateStatus;
  components: TemplateComponent[];
  variables: TemplateVariable[];
  metaTemplateId?: string;
  rejectionReason?: string;
  syncedAt?: string;
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TemplateStatus, { label: string; icon: React.ElementType; className: string }> = {
  DRAFT:    { label: 'Draft',    icon: FileText,    className: 'bg-muted text-muted-foreground border-border' },
  PENDING:  { label: 'Pending',  icon: Clock,       className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300' },
  APPROVED: { label: 'Approved', icon: CheckCircle2, className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300' },
  REJECTED: { label: 'Rejected', icon: XCircle,     className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300' },
  PAUSED:   { label: 'Paused',   icon: PauseCircle, className: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-300' },
};

function StatusBadge({ status }: { status: TemplateStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.className}`}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </span>
  );
}

function extractVariables(components: TemplateComponent[]): TemplateVariable[] {
  const vars: TemplateVariable[] = [];
  const regex = /\{\{(\d+)\}\}/g;
  for (const comp of components) {
    if (!['HEADER', 'BODY'].includes(comp.type)) continue;
    const text = comp.text ?? '';
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const pos = parseInt(m[1], 10);
      if (!vars.find((v) => v.component === comp.type && v.position === pos)) {
        vars.push({ key: `${comp.type.toLowerCase()}_var_${pos}`, position: pos, component: comp.type as 'HEADER' | 'BODY', example: '' });
      }
    }
    regex.lastIndex = 0;
  }
  return vars;
}

function renderPreviewText(text: string, vars: TemplateVariable[], values: Record<string, string>): string {
  return text.replace(/\{\{(\d+)\}\}/g, (_, n) => {
    const v = vars.find((vr) => vr.position === parseInt(n, 10));
    return v ? (values[v.key] || `{{${n}}}`) : `{{${n}}}`;
  });
}

// ─── Template Builder ─────────────────────────────────────────────────────────

const STEPS = ['Basics', 'Components', 'Preview', 'Submit'];

interface BuilderProps {
  open: boolean;
  onClose: () => void;
  onSaved: (tpl: WaTemplate) => void;
  tenantId: string;
  workspaceId?: string;
  editing?: WaTemplate | null;
}

function TemplateBuilder({ open, onClose, onSaved, tenantId, workspaceId, editing }: BuilderProps) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Step 1 — Basics
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('en');
  const [category, setCategory] = useState<TemplateCategory>('UTILITY');

  // Step 2 — Components
  const [headerEnabled, setHeaderEnabled] = useState(false);
  const [headerText, setHeaderText] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [buttons, setButtons] = useState<TemplateButton[]>([]);

  // Step 3 — Preview variable values
  const [previewVars, setPreviewVars] = useState<Record<string, string>>({});

  const components: TemplateComponent[] = [
    ...(headerEnabled && headerText ? [{ type: 'HEADER' as const, format: 'TEXT' as const, text: headerText }] : []),
    { type: 'BODY' as const, text: bodyText },
    ...(footerText ? [{ type: 'FOOTER' as const, text: footerText }] : []),
    ...(buttons.length ? [{ type: 'BUTTONS' as const, buttons }] : []),
  ];
  const variables = extractVariables(components);

  useEffect(() => {
    if (open && editing) {
      setName(editing.name);
      setLanguage(editing.language);
      setCategory(editing.category);
      const header = editing.components.find((c) => c.type === 'HEADER');
      const body = editing.components.find((c) => c.type === 'BODY');
      const footer = editing.components.find((c) => c.type === 'FOOTER');
      const btns = editing.components.find((c) => c.type === 'BUTTONS');
      setHeaderEnabled(!!header);
      setHeaderText(header?.text ?? '');
      setBodyText(body?.text ?? '');
      setFooterText(footer?.text ?? '');
      setButtons(btns?.buttons ?? []);
    } else if (open && !editing) {
      setStep(0); setName(''); setLanguage('en'); setCategory('UTILITY');
      setHeaderEnabled(false); setHeaderText(''); setBodyText('');
      setFooterText(''); setButtons([]); setPreviewVars({});
    }
  }, [open, editing]);

  const addButton = () => {
    if (buttons.length >= 10) return;
    setButtons([...buttons, { type: 'QUICK_REPLY', text: '' }]);
  };
  const updateButton = (i: number, upd: Partial<TemplateButton>) =>
    setButtons(buttons.map((b, idx) => (idx === i ? { ...b, ...upd } : b)));
  const removeButton = (i: number) => setButtons(buttons.filter((_, idx) => idx !== i));

  async function handleSave() {
    if (!name.trim() || !bodyText.trim()) {
      toast({ title: 'Required fields', description: 'Template name and body text are required.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      let saved: WaTemplate;
      const payload = { tenantId, workspaceId, name: name.trim(), language, category, components, variables };
      if (editing) {
        saved = await whatsappTemplatesApi.update(editing.id, tenantId, payload, workspaceId);
      } else {
        saved = await whatsappTemplatesApi.create(payload);
      }
      toast({ title: editing ? 'Template updated' : 'Template saved', description: `"${saved.name}" saved as DRAFT.` });
      onSaved(saved);
    } catch (e: unknown) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  const bodyPreview = renderPreviewText(bodyText, variables, previewVars);
  const headerPreview = headerEnabled ? renderPreviewText(headerText, variables, previewVars) : '';

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>{editing ? 'Edit Template' : 'New WhatsApp Template'}</SheetTitle>
        </SheetHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-6">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                className={`h-7 px-3 rounded-full text-[11px] font-medium transition-colors ${
                  i === step ? 'bg-primary text-primary-foreground' :
                  i < step ? 'bg-primary/20 text-primary hover:bg-primary/30 cursor-pointer' :
                  'bg-muted text-muted-foreground'
                }`}
              >
                {i + 1}. {s}
              </button>
              {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* ─── Step 0: Basics ─── */}
        {step === 0 && (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label>Template Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. order_confirmation"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
              />
              <p className="text-[11px] text-muted-foreground">Snake_case, letters and numbers only. This becomes the Meta template identifier.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[['en','English'],['en_US','English (US)'],['fr','French'],['es','Spanish'],['pt_BR','Portuguese (BR)'],['ar','Arabic'],['sw','Swahili']].map(([v,l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as TemplateCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTILITY">Utility</SelectItem>
                    <SelectItem value="MARKETING">Marketing</SelectItem>
                    <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">MARKETING costs more per conversation.</p>
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 1: Components ─── */}
        {step === 1 && (
          <div className="space-y-5">
            {/* Header */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Header <span className="text-muted-foreground text-[11px]">(optional)</span></Label>
                <button
                  type="button"
                  onClick={() => setHeaderEnabled(!headerEnabled)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${headerEnabled ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${headerEnabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {headerEnabled && (
                <Textarea
                  placeholder="Header text — use {{1}} for variables"
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                  rows={2}
                />
              )}
            </div>

            {/* Body */}
            <div className="rounded-lg border p-4 space-y-2">
              <Label className="text-sm font-medium">Body <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="Your message body. Use {{1}}, {{2}} for variable placeholders."
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={5}
              />
              <p className="text-[11px] text-muted-foreground">{bodyText.length} / 1024 chars · Variables detected: {variables.filter((v) => v.component === 'BODY').length}</p>
            </div>

            {/* Footer */}
            <div className="rounded-lg border p-4 space-y-2">
              <Label className="text-sm font-medium">Footer <span className="text-muted-foreground text-[11px]">(optional)</span></Label>
              <Input
                placeholder="e.g. Reply STOP to unsubscribe"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                maxLength={60}
              />
            </div>

            {/* Buttons */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Buttons <span className="text-muted-foreground text-[11px]">(optional, max 10)</span></Label>
                <Button type="button" variant="outline" size="sm" onClick={addButton} disabled={buttons.length >= 10}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Button
                </Button>
              </div>
              {buttons.map((btn, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Select value={btn.type} onValueChange={(v) => updateButton(i, { type: v as TemplateButton['type'] })}>
                    <SelectTrigger className="w-36 shrink-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="QUICK_REPLY">Quick Reply</SelectItem>
                      <SelectItem value="URL">URL</SelectItem>
                      <SelectItem value="PHONE_NUMBER">Phone</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Button text" value={btn.text} onChange={(e) => updateButton(i, { text: e.target.value })} />
                  {btn.type === 'URL' && (
                    <Input placeholder="https://..." value={btn.url ?? ''} onChange={(e) => updateButton(i, { url: e.target.value })} />
                  )}
                  {btn.type === 'PHONE_NUMBER' && (
                    <Input placeholder="+1234567890" value={btn.phone_number ?? ''} onChange={(e) => updateButton(i, { phone_number: e.target.value })} />
                  )}
                  <button type="button" onClick={() => removeButton(i)} className="mt-2 text-muted-foreground hover:text-destructive">
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Step 2: Preview ─── */}
        {step === 2 && (
          <div className="space-y-5">
            {variables.length > 0 && (
              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-sm font-medium">Fill preview values</p>
                {variables.map((v) => (
                  <div key={v.key} className="flex items-center gap-3">
                    <Label className="text-[11px] text-muted-foreground w-32 shrink-0">{`{{${v.position}}} (${v.component})`}</Label>
                    <Input
                      placeholder={`Example for ${v.key}`}
                      value={previewVars[v.key] ?? ''}
                      onChange={(e) => setPreviewVars({ ...previewVars, [v.key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* WhatsApp bubble preview */}
            <div className="rounded-xl bg-[#e5ddd5] dark:bg-zinc-700 p-6 flex justify-end">
              <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm max-w-xs w-full overflow-hidden">
                {headerEnabled && headerPreview && (
                  <div className="px-3 pt-3 pb-1">
                    <p className="font-semibold text-sm">{headerPreview}</p>
                  </div>
                )}
                <div className="px-3 py-2">
                  <p className="text-sm whitespace-pre-wrap">{bodyPreview || <span className="text-muted-foreground italic">Body text will appear here…</span>}</p>
                </div>
                {footerText && (
                  <div className="px-3 pb-2">
                    <p className="text-[11px] text-muted-foreground">{footerText}</p>
                  </div>
                )}
                {buttons.length > 0 && (
                  <div className="border-t divide-y">
                    {buttons.map((btn, i) => (
                      <div key={i} className="px-3 py-2 text-center text-sm text-primary font-medium">{btn.text || `Button ${i + 1}`}</div>
                    ))}
                  </div>
                )}
                <div className="px-3 pb-2 flex justify-end">
                  <span className="text-[10px] text-muted-foreground">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 3: Submit ─── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
              <p><span className="font-medium">Name:</span> {name}</p>
              <p><span className="font-medium">Language:</span> {language}</p>
              <p><span className="font-medium">Category:</span> {category}</p>
              <p><span className="font-medium">Components:</span> {components.map((c) => c.type).join(', ')}</p>
              <p><span className="font-medium">Variables:</span> {variables.length > 0 ? variables.map((v) => `{{${v.position}}}`).join(', ') : 'None'}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-300 space-y-1">
              <p className="font-medium">Before submitting:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[12px]">
                <li>Templates go to Meta for review — approval usually takes minutes to hours</li>
                <li>You cannot edit the template while PENDING — save a copy if needed</li>
                <li>MARKETING templates cost more per conversation than UTILITY</li>
              </ul>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <Button type="button" variant="outline" size="sm" onClick={() => step === 0 ? onClose() : setStep(step - 1)}>
            {step === 0 ? 'Cancel' : <><ChevronLeft className="h-3.5 w-3.5 mr-1" />Back</>}
          </Button>
          <div className="flex gap-2">
            {step < STEPS.length - 1 ? (
              <Button
                type="button"
                size="sm"
                onClick={() => step === STEPS.length - 2 ? handleSave().then(() => setStep(step + 1)) : setStep(step + 1)}
                disabled={saving || (step === 1 && !bodyText.trim()) || (step === 0 && !name.trim())}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                {step === STEPS.length - 2 ? 'Save & Preview' : 'Next'} <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={onClose} variant="outline">Done</Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WhatsappTemplatesPage() {
  const { toast } = useToast();
  const { tenant } = useTenant();
  const { activeWorkspace } = useWorkspace();

  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [metaTemplates, setMetaTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WaTemplate | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenant || !activeWorkspace) return;
    setLoading(true);
    try {
      const rows = await whatsappTemplatesApi.list(tenant.id, activeWorkspace);
      setTemplates(Array.isArray(rows) ? rows : []);
    } catch (e: unknown) {
      toast({ title: 'Failed to load templates', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, activeWorkspace]);

  useEffect(() => { load(); }, [load]);

  async function loadMetaTemplates() {
    if (!tenant || !activeWorkspace) return;
    setLoadingMeta(true);
    try {
      const rows = await whatsappTemplatesApi.listFromMeta(tenant.id, activeWorkspace);
      setMetaTemplates(Array.isArray(rows) ? rows : []);
    } catch (e: unknown) {
      toast({ title: 'Failed to load Meta templates', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setLoadingMeta(false);
    }
  }

  async function handleSyncAll() {
    if (!tenant || !activeWorkspace) return;
    setSyncing('all');
    try {
      const res = await whatsappTemplatesApi.syncAll(tenant.id, activeWorkspace);
      toast({ title: 'Sync complete', description: `${res.synced} synced, ${res.errors} errors.` });
      load();
    } catch (e: unknown) {
      toast({ title: 'Sync failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setSyncing(null);
    }
  }

  async function handleSync(tpl: WaTemplate) {
    if (!tenant || !activeWorkspace) return;
    setSyncing(tpl.id);
    try {
      await whatsappTemplatesApi.sync(tpl.id, tenant.id, activeWorkspace);
      toast({ title: 'Synced', description: `Status updated for "${tpl.name}".` });
      load();
    } catch (e: unknown) {
      toast({ title: 'Sync failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setSyncing(null);
    }
  }

  async function handleSubmit(tpl: WaTemplate) {
    if (!tenant || !activeWorkspace) return;
    setSubmitting(tpl.id);
    try {
      await whatsappTemplatesApi.submit(tpl.id, tenant.id, activeWorkspace);
      toast({ title: 'Submitted!', description: `"${tpl.name}" sent to Meta for approval. Status is now PENDING.` });
      load();
    } catch (e: unknown) {
      toast({ title: 'Submit failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setSubmitting(null);
    }
  }

  async function handleDelete(tpl: WaTemplate) {
    if (!tenant || !activeWorkspace) return;
    setDeleting(tpl.id);
    try {
      await whatsappTemplatesApi.remove(tpl.id, tenant.id, activeWorkspace);
      toast({ title: 'Deleted', description: `"${tpl.name}" removed.` });
      load();
    } catch (e: unknown) {
      toast({ title: 'Delete failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  }

  async function handleImport(metaTpl: any) {
    if (!tenant) return;
    setImporting(metaTpl.metaId);
    try {
      await whatsappTemplatesApi.importFromMeta(tenant.id, activeWorkspace, metaTpl);
      toast({ title: 'Imported', description: `"${metaTpl.name}" added to your local templates.` });
      load();
    } catch (e: unknown) {
      toast({ title: 'Import failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setImporting(null);
    }
  }

  const isAlreadyImported = (metaTpl: any) =>
    templates.some((t) => t.name === metaTpl.name && t.language === metaTpl.language);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 dark:bg-green-950">
            <MessageCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">WhatsApp Templates</h1>
            <p className="text-sm text-muted-foreground">Create, submit, and track Meta-approved message templates</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAll}
            disabled={syncing === 'all' || !tenant}
          >
            {syncing === 'all' ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
            Sync All
          </Button>
          <Button size="sm" className="gradient-primary text-primary-foreground border-0" onClick={() => { setEditingTemplate(null); setBuilderOpen(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New Template
          </Button>
        </div>
      </div>

      <Tabs defaultValue="mine">
        <TabsList className="mb-4">
          <TabsTrigger value="mine">My Templates ({templates.length})</TabsTrigger>
          <TabsTrigger value="meta" onClick={() => metaTemplates.length === 0 && loadMetaTemplates()}>
            From Meta
          </TabsTrigger>
        </TabsList>

        {/* ── My Templates tab ── */}
        <TabsContent value="mine">
          {loading ? (
            <div className="py-16 flex items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : templates.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center space-y-3">
                <MessageCircle className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">No templates yet. Create one or import from Meta.</p>
                <Button size="sm" onClick={() => { setEditingTemplate(null); setBuilderOpen(true); }}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> New Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {templates.map((tpl) => {
                const body = tpl.components.find((c) => c.type === 'BODY');
                const canEdit = tpl.status === 'DRAFT' || tpl.status === 'REJECTED';
                const canSubmit = tpl.status === 'DRAFT' || tpl.status === 'REJECTED';
                const canSync = !!tpl.metaTemplateId || tpl.status === 'PENDING';
                return (
                  <Card key={tpl.id} className="border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-medium">{tpl.name}</span>
                            <StatusBadge status={tpl.status} />
                            <span className="text-[11px] text-muted-foreground">{tpl.language} · {tpl.category}</span>
                          </div>
                          {body?.text && (
                            <p className="text-sm text-muted-foreground truncate max-w-lg">{body.text}</p>
                          )}
                          {tpl.rejectionReason && (
                            <p className="text-[11px] text-destructive">Rejected: {tpl.rejectionReason}</p>
                          )}
                          {tpl.syncedAt && (
                            <p className="text-[10px] text-muted-foreground">Synced {new Date(tpl.syncedAt).toLocaleString()}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                          {canSync && (
                            <Button variant="ghost" size="sm" onClick={() => handleSync(tpl)} disabled={syncing === tpl.id} title="Sync status from Meta">
                              {syncing === tpl.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                          {canEdit && (
                            <Button variant="ghost" size="sm" onClick={() => { setEditingTemplate(tpl); setBuilderOpen(true); }} title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canSubmit && (
                            <Button
                              size="sm"
                              className="gradient-primary text-primary-foreground border-0"
                              onClick={() => handleSubmit(tpl)}
                              disabled={submitting === tpl.id}
                            >
                              {submitting === tpl.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                              Submit
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(tpl)}
                            disabled={deleting === tpl.id || tpl.status === 'PENDING'}
                            title={tpl.status === 'PENDING' ? 'Cannot delete while pending' : 'Delete'}
                          >
                            {deleting === tpl.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── From Meta tab ── */}
        <TabsContent value="meta">
          <div className="flex justify-end mb-4">
            <Button variant="outline" size="sm" onClick={loadMetaTemplates} disabled={loadingMeta}>
              {loadingMeta ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Refresh from Meta
            </Button>
          </div>
          {loadingMeta ? (
            <div className="py-16 flex items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Fetching from Meta…
            </div>
          ) : metaTemplates.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center space-y-2">
                <p className="text-sm text-muted-foreground">No Meta templates found. Connect WhatsApp first or click Refresh.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {metaTemplates.map((t) => {
                const imported = isAlreadyImported(t);
                return (
                  <Card key={t.metaId} className="border-border/50">
                    <CardContent className="p-4 flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-medium">{t.name}</span>
                          <StatusBadge status={t.status as TemplateStatus} />
                          <span className="text-[11px] text-muted-foreground">{t.language} · {t.category}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">Meta ID: {t.metaId}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={imported ? 'outline' : 'default'}
                        disabled={imported || importing === t.metaId}
                        onClick={() => handleImport(t)}
                      >
                        {importing === t.metaId ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                        {imported ? 'Imported' : 'Import'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Template Builder Sheet */}
      <TemplateBuilder
        open={builderOpen}
        onClose={() => { setBuilderOpen(false); setEditingTemplate(null); }}
        onSaved={(tpl) => { setBuilderOpen(false); setEditingTemplate(null); load(); }}
        tenantId={tenant?.id ?? ''}
        workspaceId={activeWorkspace}
        editing={editingTemplate}
      />
    </div>
  );
}
