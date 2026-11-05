import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Building2, Users, CreditCard, Sparkles, Activity, Server, Settings,
  TrendingUp, Globe, Zap, CheckCircle2, XCircle, Loader2, ArrowLeft,
  FileText, Share2, MessageSquare, ClipboardList, Shield, ExternalLink,
  ChevronRight, Bot, BookOpen, Key, AlertTriangle, Search, Wallet, Undo2, Tags, MessageCircleMore, Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { SuperAdminRoute } from '@/components/SuperAdminRoute';
import { backofficeApi } from '@/lib/api';
import { BackofficePlansTab } from './BackofficePlansTab';
import { BackofficeRefundsTab } from './BackofficeRefundsTab';
import { BackofficeSubscriptionsTab } from './BackofficeSubscriptionsTab';
import { PlatformIntegrationsForm } from '@/components/admin/PlatformIntegrationsForm';
import { SmsSettings } from '@/components/admin/SmsSettings';
import { SmsTestForm } from '@/components/admin/SmsTestForm';

type Overview = Awaited<ReturnType<typeof backofficeApi.getOverview>>;
type TenantRow = Awaited<ReturnType<typeof backofficeApi.listTenants>>[number];
type TenantDetail = Awaited<ReturnType<typeof backofficeApi.getTenant>>;

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  size = 'lg',
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  sub?: string;
  size?: 'lg' | 'sm';
}) {
  return (
    <Card className="border-border/60">
      <CardContent className={size === 'lg' ? 'space-y-2 p-5' : 'space-y-1 p-4'}>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{label}</span>
          <Icon className="h-4 w-4" />
        </div>
        <p className={cn('font-display font-bold tabular-nums tracking-tight', size === 'lg' ? 'text-3xl' : 'text-xl')}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

type SectionKey =
  | 'overview' | 'tenants' | 'subscriptions' | 'revenue' | 'refunds' | 'plans'
  | 'ai' | 'chatbot' | 'activity' | 'health' | 'integrations' | 'sms' | 'company';

const SECTION_GROUPS: Array<{ label: string; items: Array<{ key: SectionKey; label: string; icon: React.ComponentType<{ className?: string }> }> }> = [
  {
    label: 'Business',
    items: [
      { key: 'overview', label: 'Overview', icon: TrendingUp },
      { key: 'tenants', label: 'Tenants', icon: Building2 },
      { key: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
      { key: 'revenue', label: 'Revenue', icon: Wallet },
      { key: 'refunds', label: 'Refunds', icon: Undo2 },
      { key: 'plans', label: 'Plans & pricing', icon: Tags },
    ],
  },
  {
    label: 'Product usage',
    items: [
      { key: 'ai', label: 'AI usage', icon: Sparkles },
      { key: 'chatbot', label: 'Chatbot', icon: MessageCircleMore },
      { key: 'activity', label: 'Activity log', icon: ClipboardList },
    ],
  },
  {
    label: 'Platform',
    items: [
      { key: 'health', label: 'Health', icon: Activity },
      { key: 'integrations', label: 'Integrations', icon: Key },
      { key: 'sms', label: 'SMS', icon: MessageSquare },
      { key: 'company', label: 'About Mako', icon: Info },
    ],
  },
];
const SECTION_KEYS = SECTION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

function EnvRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span>{label}</span>
      {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
    </div>
  );
}

function GrowthBars({ data }: { data: Array<{ month: string; count: number }> }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex h-40 items-end gap-3" role="img" aria-label={data.map((d) => `${d.month}: ${d.count}`).join(', ')}>
      {data.map((d) => (
        <div key={d.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
          <span className="text-xs font-semibold tabular-nums">{d.count}</span>
          {/* The bar's height is relative to this full-height column. */}
          <div className="w-full max-w-12 rounded-t bg-[var(--chart-1)]" style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }} />
          <span className="text-[11px] text-muted-foreground">
            {new Date(`${d.month}-01T12:00:00Z`).toLocaleDateString(undefined, { month: 'short' })}
          </span>
        </div>
      ))}
    </div>
  );
}

const PROVIDER_LABEL: Record<string, string> = { openai: 'OpenAI', mistral: 'Mistral', gemini: 'Gemini', deepseek: 'DeepSeek' };

/** Which engines answer chats and index chatbot documents, and the vector database's state. */
function AiKnowledgeCard({ onOpenIntegrations }: { onOpenIntegrations: () => void }) {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof backofficeApi.getAiStatus>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [reindexing, setReindexing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    backofficeApi.getAiStatus().then(setStatus).catch(() => setStatus(null)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const reindex = async () => {
    if (!window.confirm('Re-process every chatbot document on the platform? Chatbots answer from the old index until each document finishes.')) return;
    setReindexing(true);
    try {
      const { queued } = await backofficeApi.reindexKnowledge();
      setMessage(`${queued} document${queued === 1 ? '' : 's'} queued for re-indexing. Refresh to follow progress.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Re-index failed to start');
    } finally {
      setReindexing(false);
    }
  };

  const docs = status?.documents ?? {};
  const qdrantOk = status?.qdrantConfigured && status.qdrant?.reachable;

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" /> AI &amp; chatbot knowledge base</CardTitle>
          <CardDescription>Which engines answer chats and search uploaded documents.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>Refresh</Button>
          <Button size="sm" variant="outline" onClick={() => void reindex()} disabled={reindexing || loading}>
            {reindexing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null} Re-index all documents
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {loading && !status ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : !status ? (
          <p className="text-destructive">Could not load AI status.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Default chat provider</p>
                <p className="mt-1 font-semibold">{PROVIDER_LABEL[status.defaultProvider] ?? status.defaultProvider}</p>
                <p className="text-xs text-muted-foreground">For workspaces without their own choice</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Document search model</p>
                <p className="mt-1 font-semibold">{status.embedModel}</p>
                <p className="text-xs text-muted-foreground">{PROVIDER_LABEL[status.embedProvider] ?? status.embedProvider}, same for every workspace</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Vector database</p>
                {!status.qdrantConfigured ? (
                  <>
                    <p className="mt-1 font-semibold">Postgres (built in)</p>
                    <button type="button" className="text-xs text-primary underline" onClick={onOpenIntegrations}>Connect Qdrant</button>
                  </>
                ) : qdrantOk ? (
                  <>
                    <p className="mt-1 flex items-center gap-1 font-semibold text-green-700 dark:text-green-400"><CheckCircle2 className="h-4 w-4" /> Qdrant connected</p>
                    <p className="text-xs text-muted-foreground">{status.qdrant?.points.toLocaleString()} vectors in {status.collection}</p>
                  </>
                ) : (
                  <>
                    <p className="mt-1 flex items-center gap-1 font-semibold text-destructive"><XCircle className="h-4 w-4" /> Qdrant unreachable</p>
                    <p className="break-words text-xs text-muted-foreground">{status.qdrant?.error}</p>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="text-muted-foreground">Documents:</span>
              {['ready', 'processing', 'pending', 'failed'].map((k) => (
                <Badge key={k} variant={k === 'failed' && docs[k] ? 'destructive' : 'secondary'} className="capitalize">{k} {docs[k] ?? 0}</Badge>
              ))}
            </div>
            {message && <p className="text-xs text-muted-foreground">{message}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Mistral powers the chatbot, document reading and media features, so check the key really works. */
function MistralKeyRow({ configured, onOpenIntegrations }: { configured: boolean; onOpenIntegrations: () => void }) {
  const [state, setState] = useState<{ status: 'idle' | 'testing' | 'ok' | 'failed'; message?: string }>({ status: 'idle' });
  const test = async () => {
    setState({ status: 'testing' });
    try {
      const res = await backofficeApi.testMistral();
      setState(res.ok ? { status: 'ok' } : { status: 'failed', message: res.message });
    } catch (err) {
      setState({ status: 'failed', message: err instanceof Error ? err.message : 'Test failed' });
    }
  };
  return (
    <div className="space-y-1.5 rounded-md border border-border/60 p-2.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span>Mistral AI <span className="text-xs text-muted-foreground">(chatbot, documents, media)</span></span>
        <span className="flex items-center gap-2">
          {state.status === 'ok' && <span className="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400"><CheckCircle2 className="h-4 w-4" /> Working</span>}
          {state.status === 'failed' && <span className="flex items-center gap-1 text-xs font-medium text-destructive"><XCircle className="h-4 w-4" /> Not working</span>}
          {state.status === 'idle' && (configured ? <span className="text-xs text-muted-foreground">Key saved</span> : <span className="flex items-center gap-1 text-xs font-medium text-destructive"><XCircle className="h-4 w-4" /> No key</span>)}
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => void test()} disabled={state.status === 'testing' || !configured}>
            {state.status === 'testing' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Test'}
          </Button>
        </span>
      </div>
      {state.status === 'failed' && (
        <p className="text-xs text-destructive">
          {state.message}{' '}
          <button type="button" className="underline" onClick={onOpenIntegrations}>Open Integrations</button>
        </p>
      )}
    </div>
  );
}

function formatAuditJson(value: unknown): string {
  if (value == null) return 'null';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function TenantDetailSheet({
  tenantId,
  open,
  onOpenChange,
}: {
  tenantId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tenantId || !open) return;
    setLoading(true);
    backofficeApi.getTenant(tenantId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [tenantId, open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground pt-8">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading tenant…
          </div>
        ) : detail ? (
          <>
            <SheetHeader>
              <SheetTitle>{detail.name}</SheetTitle>
              <SheetDescription>{detail.slug} · {detail.ownerEmail ?? 'No owner email'}</SheetDescription>
            </SheetHeader>
            <div className="mt-0 space-y-6">
              <div className="flex gap-2">
                <Badge variant="outline" className="capitalize">{detail.subscription.plan}</Badge>
                <Badge variant={detail.subscription.status === 'active' ? 'default' : 'secondary'}>
                  {detail.subscription.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Members', detail.stats.members],
                  ['Content', detail.stats.contentItems],
                  ['Published', detail.stats.publications],
                  ['Leads', detail.stats.leads],
                  ['AI tokens', detail.stats.aiTokens.toLocaleString()],
                ].map(([label, val]) => (
                  <div key={String(label)} className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-semibold">{val}</p>
                  </div>
                ))}
              </div>
              {detail.chatbot && (
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Bot className="h-4 w-4" /> AI Chatbot
                  </p>
                  <div className="rounded-lg border p-3 space-y-3 text-sm">
                    <div className="flex flex-wrap gap-2">
                      {detail.chatbot.widgetEnabled && <Badge variant="default">Widget live</Badge>}
                      {detail.chatbot.ragEnabled && <Badge variant="secondary">RAG</Badge>}
                      {detail.chatbot.useMistralLibrary && <Badge variant="outline">Mistral Library</Badge>}
                      {detail.chatbot.widgetTtsEnabled && <Badge variant="outline">TTS</Badge>}
                      {!detail.chatbot.isActive && <Badge variant="destructive">Inactive</Badge>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ['Sessions', detail.chatbot.sessions],
                        ['Last 7 days', detail.chatbot.sessionsLast7Days],
                        ['Messages', detail.chatbot.messages],
                        ['Knowledge docs', detail.chatbot.knowledgeDocuments],
                        ['Ready', detail.chatbot.knowledgeReady],
                        ['Failed', detail.chatbot.knowledgeFailed],
                        ['Chunks', detail.chatbot.knowledgeChunks],
                        ['API keys', detail.chatbot.activeApiKeys],
                      ].map(([label, val]) => (
                        <div key={String(label)} className="rounded border px-2 py-1.5">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="font-semibold">{val}</p>
                        </div>
                      ))}
                    </div>
                    {Object.keys(detail.chatbot.sessionsByChannel).length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Sessions by channel</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(detail.chatbot.sessionsByChannel).map(([ch, n]) => (
                            <Badge key={ch} variant="outline" className="capitalize">{ch}: {n}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div>
                <p className="text-sm font-medium mb-2">Connected accounts</p>
                {detail.socialAccounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None connected</p>
                ) : (
                  <div className="space-y-2">
                    {detail.socialAccounts.map((s) => (
                      <div key={s.id} className="flex justify-between text-sm border-b pb-2">
                        <span className="capitalize">{s.platform}</span>
                        <span className="text-muted-foreground">{s.accountName}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {detail.recentDeposits.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Recent payments</p>
                  {detail.recentDeposits.map((d) => (
                    <div key={d.id} className="flex justify-between text-sm py-1">
                      <span>{d.amount} {d.currency}</span>
                      <Badge variant="secondary">{d.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Joined {new Date(detail.createdAt).toLocaleDateString()}
                {detail.subscription.billingPeriodEnd && (
                  <> · Billing ends {new Date(detail.subscription.billingPeriodEnd).toLocaleDateString()}</>
                )}
              </p>
            </div>
          </>
        ) : (
          <p className="text-destructive pt-8">Could not load tenant details</p>
        )}
      </SheetContent>
    </Sheet>
  );
}

function BackofficeContent() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [pricingPlans, setPricingPlans] = useState<Awaited<ReturnType<typeof backofficeApi.getPlans>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedCronKey, setSelectedCronKey] = useState<string | null>(null);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(8);
  const [auditFrom, setAuditFrom] = useState('');
  const [auditTo, setAuditTo] = useState('');
  const [auditAction, setAuditAction] = useState('all');
  const [auditResource, setAuditResource] = useState('all');
  const [auditTenant, setAuditTenant] = useState('');
  const [auditUser, setAuditUser] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [tenantSearch, setTenantSearch] = useState('');
  const [tenantPlan, setTenantPlan] = useState('all');
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('section') as SectionKey | null;
  const section: SectionKey = requested && SECTION_KEYS.includes(requested) ? requested : 'overview';
  // Kept in the URL so a refresh or a shared link opens the same section.
  const setSection = (key: SectionKey) => {
    const next = new URLSearchParams(searchParams);
    if (key === 'overview') next.delete('section');
    else next.set('section', key);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    Promise.all([backofficeApi.getOverview(), backofficeApi.listTenants(), backofficeApi.getPlans()])
      .then(([ov, t, plans]) => {
        setOverview(ov);
        setTenants(t);
        setPricingPlans(plans);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load backoffice'))
      .finally(() => setLoading(false));
  }, []);

  const openTenant = (id: string) => {
    setSelectedTenantId(id);
    setSheetOpen(true);
  };

  const auditOptions = useMemo(() => {
    if (!overview) return { actions: [], resources: [] };
    return {
      actions: Array.from(new Set(overview.recentAudit.map((a) => a.action))).sort(),
      resources: Array.from(new Set(overview.recentAudit.map((a) => a.resourceType))).sort(),
    };
  }, [overview]);

  const filteredAuditEntries = useMemo(() => {
    if (!overview) return [];
    return overview.recentAudit.filter((a) => {
      const createdAt = new Date(a.createdAt);
      if (auditFrom && createdAt < new Date(`${auditFrom}T00:00:00`)) return false;
      if (auditTo && createdAt > new Date(`${auditTo}T23:59:59.999`)) return false;
      if (auditAction !== 'all' && a.action !== auditAction) return false;
      if (auditResource !== 'all' && a.resourceType !== auditResource) return false;
      if (auditTenant && !(a.tenantName ?? '').toLowerCase().includes(auditTenant.toLowerCase())) return false;
      if (auditUser && !(a.userEmail ?? '').toLowerCase().includes(auditUser.toLowerCase())) return false;
      if (auditSearch) {
        const haystack = `${a.action} ${a.resourceType} ${a.tenantName ?? ''} ${a.userEmail ?? ''}`.toLowerCase();
        if (!haystack.includes(auditSearch.toLowerCase())) return false;
      }
      return true;
    });
  }, [overview, auditFrom, auditTo, auditAction, auditResource, auditTenant, auditUser, auditSearch]);

  const auditPageCount = Math.max(1, Math.ceil(filteredAuditEntries.length / auditPageSize));
  const pagedAuditEntries = filteredAuditEntries.slice((auditPage - 1) * auditPageSize, auditPage * auditPageSize);

  useEffect(() => {
    setAuditPage(1);
  }, [auditFrom, auditTo, auditAction, auditResource, auditTenant, auditUser, auditSearch, auditPageSize]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading platform data…
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="max-w-lg mx-auto p-8 text-center text-destructive">
        {error || 'Unable to load backoffice'}
      </div>
    );
  }

  const { company, stats, chatbot, planDistribution, aiByFunction, recentDeposits, recentTenants, crons, cronHealth, env } = overview;

  const tenantPlans = Array.from(new Set(tenants.map((t) => t.plan))).sort();
  const visibleTenants = tenants.filter((t) => {
    if (tenantPlan !== 'all' && t.plan !== tenantPlan) return false;
    if (!tenantSearch) return true;
    const q = tenantSearch.toLowerCase();
    return t.name.toLowerCase().includes(q) || (t.ownerEmail ?? '').toLowerCase().includes(q);
  });

  const missingIntegrations = [
    ['Mistral AI', env.mistralConfigured],
    ['Meta', env.metaConfigured],
    ['LinkedIn', env.linkedInConfigured],
    ['PawaPay', env.pawapayConfigured],
  ].filter(([, ok]) => !ok).map(([name]) => String(name));
  const failedCrons = cronHealth.filter((c) => c.status === 'failed');
  const attention: Array<{ label: string; section: SectionKey }> = [
    ...failedCrons.map((c) => ({ label: `${c.name} job failing`, section: 'health' as const })),
    ...(missingIntegrations.length ? [{ label: `${missingIntegrations.join(', ')} not configured`, section: 'health' as const }] : []),
    ...(stats.pendingDataDeletions > 0 ? [{ label: `${stats.pendingDataDeletions} data deletion request${stats.pendingDataDeletions === 1 ? '' : 's'}`, section: 'activity' as const }] : []),
    ...(stats.knowledgeFailed > 0 ? [{ label: `${stats.knowledgeFailed} knowledge doc${stats.knowledgeFailed === 1 ? '' : 's'} failed`, section: 'chatbot' as const }] : []),
  ];

  return (
    <div className="w-full space-y-6 sm:space-y-8 pb-8 sm:pb-10 min-w-0">
      <TenantDetailSheet tenantId={selectedTenantId} open={sheetOpen} onOpenChange={setSheetOpen} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Platform backoffice</h1>
          <p className="text-sm text-muted-foreground">Customers, money and platform health for {company.product}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/queues"><Activity className="mr-2 h-4 w-4" /> Job queues</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/system"><Settings className="mr-2 h-4 w-4" /> System settings</Link>
          </Button>
        </div>
      </div>

      {attention.length > 0 ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            {attention.length} thing{attention.length === 1 ? '' : 's'} need{attention.length === 1 ? 's' : ''} attention
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {attention.map((a) => (
              <li key={a.label}>
                <button
                  type="button"
                  onClick={() => setSection(a.section)}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium hover:bg-muted"
                >
                  {a.label} <ChevronRight className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-green-600" /> All background jobs and integrations look healthy.
        </p>
      )}

      <div className="lg:hidden">
        <Select value={section} onValueChange={(v) => setSection(v as SectionKey)}>
          <SelectTrigger aria-label="Backoffice section"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SECTION_GROUPS.flatMap((g) => g.items).map((item) => (
              <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 lg:grid-cols-[210px_minmax(0,1fr)] lg:items-start">
        <nav aria-label="Backoffice sections" className="hidden space-y-5 lg:sticky lg:top-4 lg:block">
          {SECTION_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = section === item.key;
                  const count = item.key === 'tenants' ? stats.tenants : item.key === 'chatbot' ? stats.chatSessions : undefined;
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        aria-current={active ? 'page' : undefined}
                        onClick={() => setSection(item.key)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                          active ? 'bg-card font-semibold text-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 text-left">{item.label}</span>
                        {count !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

      <Tabs value={section} onValueChange={(v) => setSection(v as SectionKey)} className="min-w-0">
        <TabsContent value="overview" className="mt-0 space-y-6">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard label="Tenants" value={stats.tenants} icon={Building2} sub={`${stats.activeMembers} active members`} />
            <StatCard label="Est. monthly revenue" value={`ZMW ${stats.estimatedMrrZmw.toLocaleString()}`} icon={TrendingUp} sub={`ZMW ${stats.revenueTotalZmw.toFixed(0)} collected in total`} />
            <StatCard label="Users" value={stats.users} icon={Users} />
            <StatCard label="Posts published" value={stats.publications} icon={Share2} sub={`${stats.contentItems} posts written`} />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">New tenants by month</CardTitle>
              </CardHeader>
              <CardContent>
                {overview.tenantGrowth.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No growth data yet</p>
                ) : (
                  <GrowthBars data={overview.tenantGrowth} />
                )}
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">Newest tenants</CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSection('tenants')}>View all</Button>
              </CardHeader>
              <CardContent className="space-y-1">
                {recentTenants.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tenants yet</p>
                ) : (
                  recentTenants.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => openTenant(t.id)}
                      className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-muted/50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{t.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{t.ownerEmail ?? t.slug}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Platform usage</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              <StatCard size="sm" label="Leads captured" value={stats.leads} icon={MessageSquare} />
              <StatCard size="sm" label="Comment replies" value={stats.commentReplies} icon={MessageSquare} />
              <StatCard size="sm" label="Chat sessions" value={stats.chatSessions} icon={Bot} sub={`${stats.chatSessionsLast7Days} in the last 7 days`} />
              <StatCard size="sm" label="Chat messages" value={stats.chatMessages} icon={MessageSquare} />
              <StatCard size="sm" label="Knowledge docs" value={stats.knowledgeDocuments} icon={BookOpen} sub={`${stats.knowledgeReady} ready · ${stats.knowledgeFailed} failed`} />
              <StatCard size="sm" label="Live chat widgets" value={stats.widgetsEnabled} icon={Globe} sub={`${stats.activeChatbotApiKeys} API keys`} />
              <StatCard size="sm" label="Audit events" value={stats.auditLogs} icon={ClipboardList} />
              <StatCard size="sm" label="Pending deletions" value={stats.pendingDataDeletions} icon={Shield} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tenants" className="mt-0">
          <Card>
            <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Tenants</CardTitle>
                <CardDescription>{visibleTenants.length} of {tenants.length} · click a row for details</CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={tenantSearch} onChange={(e) => setTenantSearch(e.target.value)} placeholder="Name or owner email" className="h-9 w-56 pl-8" aria-label="Search tenants" />
                </div>
                <Select value={tenantPlan} onValueChange={setTenantPlan}>
                  <SelectTrigger className="h-9 w-32" aria-label="Filter by plan"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All plans</SelectItem>
                    {tenantPlans.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Owner</th>
                    <th className="pb-2 pr-4">Plan</th>
                    <th className="pb-2 pr-4">Members</th>
                    <th className="pb-2 pr-4">Content</th>
                    <th className="pb-2 pr-4">Storage</th>
                    <th className="pb-2 pr-4">Widget</th>
                    <th className="pb-2 pr-4">Sessions</th>
                    <th className="pb-2">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTenants.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b last:border-0 cursor-pointer hover:bg-muted/40"
                      onClick={() => openTenant(t.id)}
                    >
                      <td className="py-3 pr-4 font-medium">{t.name}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{t.ownerEmail ?? '—'}</td>
                      <td className="py-3 pr-4"><Badge variant="outline" className="capitalize">{t.plan}</Badge></td>
                      <td className="py-3 pr-4">{t.members}</td>
                      <td className="py-3 pr-4">{t.contentItems}</td>
                      <td className="py-3 pr-4">
                        {t.storageUsedBytes ? `${(t.storageUsedBytes / 1024 / 1024).toFixed(1)} MB` : '0 MB'}
                      </td>
                      <td className="py-3 pr-4">
                        {t.widgetEnabled ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </td>
                      <td className="py-3 pr-4">{t.chatSessions}</td>
                      <td className="py-3 text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions" className="mt-0">
          <BackofficeSubscriptionsTab onOpenTenant={openTenant} />
        </TabsContent>

        <TabsContent value="refunds" className="mt-0">
          <BackofficeRefundsTab />
        </TabsContent>

        <TabsContent value="revenue" className="mt-0 space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <StatCard label="Total revenue (deposits)" value={`ZMW ${stats.revenueTotalZmw.toFixed(0)}`} icon={CreditCard} />
            <StatCard label="Estimated MRR" value={`ZMW ${stats.estimatedMrrZmw}`} icon={TrendingUp} />
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Plan distribution</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(planDistribution).map(([plan, count]) => (
                <div key={plan} className="flex justify-between text-sm">
                  <span className="capitalize">{plan}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Recent deposits</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {recentDeposits.length === 0 ? (
                <p className="text-sm text-muted-foreground">No deposits recorded</p>
              ) : (
                recentDeposits.map((d) => (
                  <div key={d.id} className="flex justify-between text-sm py-2 border-b last:border-0">
                    <span>{d.tenantName ?? 'Unknown tenant'} · {d.plan ?? '—'} · {d.amount} {d.currency}</span>
                    <Badge variant={d.status === 'completed' ? 'default' : 'secondary'}>{d.status}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="mt-0">
          <BackofficePlansTab onSaved={setPricingPlans} />
        </TabsContent>

        <TabsContent value="sms" className="mt-0 space-y-4">
          <SmsSettings />
          <SmsTestForm />
        </TabsContent>

        <TabsContent value="integrations" className="mt-0">
          <PlatformIntegrationsForm />
        </TabsContent>

        <TabsContent value="ai" className="mt-0 space-y-6">
          <StatCard label="AI tokens (recent sample)" value={stats.aiTokensLastPeriod.toLocaleString()} icon={Sparkles} />
          <Card>
            <CardHeader><CardTitle className="text-base">Usage by function</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(aiByFunction).length === 0 ? (
                <p className="text-sm text-muted-foreground">No AI usage yet</p>
              ) : (
                Object.entries(aiByFunction)
                  .sort((a, b) => b[1] - a[1])
                  .map(([fn, tokens]) => (
                    <div key={fn} className="flex justify-between text-sm">
                      <span className="font-mono text-xs">{fn}</span>
                      <span>{tokens.toLocaleString()} tokens</span>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chatbot" className="mt-0 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Chatbot configs" value={stats.chatbotConfigs} icon={Bot} />
            <StatCard label="Widgets enabled" value={stats.widgetsEnabled} icon={Globe} />
            <StatCard label="RAG enabled" value={stats.ragEnabledTenants} icon={BookOpen} />
            <StatCard label="Active API keys" value={stats.activeChatbotApiKeys} icon={Key} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total sessions" value={stats.chatSessions} icon={MessageSquare} sub={`${stats.chatSessionsLast7Days} last 7 days`} />
            <StatCard label="Messages" value={stats.chatMessages} icon={MessageSquare} />
            <StatCard label="Knowledge chunks" value={stats.knowledgeChunks} icon={BookOpen} sub={`${stats.knowledgeDocuments} documents`} />
            <StatCard label="Chatbot AI tokens" value={chatbot.aiTokensChatbot.toLocaleString()} icon={Sparkles} />
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Sessions by channel</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(chatbot.sessionsByChannel).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No chat sessions yet</p>
                ) : (
                  Object.entries(chatbot.sessionsByChannel)
                    .sort((a, b) => b[1] - a[1])
                    .map(([channel, count]) => (
                      <div key={channel} className="flex justify-between text-sm">
                        <span className="capitalize">{channel}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Knowledge by status</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(chatbot.knowledgeByStatus).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No knowledge documents yet</p>
                ) : (
                  Object.entries(chatbot.knowledgeByStatus)
                    .sort((a, b) => b[1] - a[1])
                    .map(([status, count]) => (
                      <div key={status} className="flex justify-between text-sm">
                        <span className="capitalize">{status.replace(/_/g, ' ')}</span>
                        <Badge variant={status === 'failed' ? 'destructive' : 'secondary'}>{count}</Badge>
                      </div>
                    ))
                )}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Feature adoption</CardTitle>
              <CardDescription>Tenants with chatbot capabilities enabled</CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-3 gap-4 text-sm">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Mistral Library</p>
                <p className="text-xl font-bold">{stats.mistralLibraryTenants}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Widget TTS</p>
                <p className="text-xl font-bold">{stats.ttsEnabledTenants}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Knowledge failed</p>
                <p className="text-xl font-bold text-destructive">{stats.knowledgeFailed}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-0 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Recent audit events</CardTitle>
                    <CardDescription>Platform-wide governance trail</CardDescription>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Showing {filteredAuditEntries.length === 0 ? 0 : (auditPage - 1) * auditPageSize + 1}-{Math.min(auditPage * auditPageSize, filteredAuditEntries.length)} of {filteredAuditEntries.length}
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-6">
                  <input value={auditFrom} onChange={(e) => setAuditFrom(e.target.value)} type="date" className="h-9 rounded-md border bg-background px-2 text-sm" aria-label="Audit from date" />
                  <input value={auditTo} onChange={(e) => setAuditTo(e.target.value)} type="date" className="h-9 rounded-md border bg-background px-2 text-sm" aria-label="Audit to date" />
                  <select value={auditAction} onChange={(e) => setAuditAction(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm" aria-label="Filter by action">
                    <option value="all">All actions</option>
                    {auditOptions.actions.map((action) => (
                      <option key={action} value={action}>{action}</option>
                    ))}
                  </select>
                  <select value={auditResource} onChange={(e) => setAuditResource(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm" aria-label="Filter by resource type">
                    <option value="all">All resources</option>
                    {auditOptions.resources.map((resource) => (
                      <option key={resource} value={resource}>{resource}</option>
                    ))}
                  </select>
                  <input value={auditTenant} onChange={(e) => setAuditTenant(e.target.value)} placeholder="Tenant" className="h-9 rounded-md border bg-background px-2 text-sm" aria-label="Filter by tenant" />
                  <input value={auditUser} onChange={(e) => setAuditUser(e.target.value)} placeholder="User email" className="h-9 rounded-md border bg-background px-2 text-sm" aria-label="Filter by user email" />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <input value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} placeholder="Search action, tenant, user..." className="h-9 w-full sm:max-w-xs rounded-md border bg-background px-2 text-sm" aria-label="Search audit events" />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Per page</span>
                    <select value={auditPageSize} onChange={(e) => setAuditPageSize(Number(e.target.value))} className="h-8 rounded-md border bg-background px-2" aria-label="Audit page size">
                      <option value={5}>5</option>
                      <option value={8}>8</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                    </select>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {filteredAuditEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No audit events match the current filters</p>
              ) : (
                pagedAuditEntries.map((a) => {
                  const isSelected = selectedAuditId === a.id;

                  return (
                    <div key={a.id} className="rounded-lg border overflow-hidden">
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full justify-start rounded-none p-0 h-auto"
                        onClick={() => setSelectedAuditId(isSelected ? null : a.id)}
                      >
                        <div className="w-full p-3 text-left">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-sm">{a.action} · {a.resourceType}</span>
                            <Badge variant="outline" className="uppercase tracking-wide text-[10px]">
                              {a.resourceType}
                            </Badge>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground space-y-1">
                            <div>{a.tenantName ?? '—'} · {a.userEmail ?? '—'}</div>
                            <div>{new Date(a.createdAt).toLocaleString()}</div>
                          </div>
                        </div>
                      </Button>
                      {isSelected && (
                        <div className="border-t bg-muted/30 p-3 text-xs space-y-3">
                          <div className="grid gap-1.5 sm:grid-cols-2">
                            <div><span className="text-muted-foreground">Audit ID:</span> {a.id}</div>
                            <div><span className="text-muted-foreground">Action:</span> {a.action}</div>
                            <div><span className="text-muted-foreground">Tenant:</span> {a.tenantName ?? '—'}</div>
                            <div><span className="text-muted-foreground">User:</span> {a.userEmail ?? '—'}</div>
                            <div className="sm:col-span-2"><span className="text-muted-foreground">Timestamp:</span> {new Date(a.createdAt).toLocaleString()}</div>
                          </div>

                          {a.beforeState != null && (
                            <div>
                              <div className="font-medium text-foreground mb-1">Before JSON</div>
                              <pre className="whitespace-pre-wrap break-all rounded-md border bg-background/80 p-2 text-[11px] text-muted-foreground overflow-auto max-h-64">{formatAuditJson(a.beforeState)}</pre>
                            </div>
                          )}

                          {a.afterState != null && (
                            <div>
                              <div className="font-medium text-foreground mb-1">After JSON</div>
                              <pre className="whitespace-pre-wrap break-all rounded-md border bg-background/80 p-2 text-[11px] text-muted-foreground overflow-auto max-h-64">{formatAuditJson(a.afterState)}</pre>
                            </div>
                          )}

                          {a.metadata != null && (
                            <div>
                              <div className="font-medium text-foreground mb-1">Metadata JSON</div>
                              <pre className="whitespace-pre-wrap break-all rounded-md border bg-background/80 p-2 text-[11px] text-muted-foreground overflow-auto max-h-64">{formatAuditJson(a.metadata)}</pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              {filteredAuditEntries.length > 0 && (
                <div className="flex items-center justify-between gap-3 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setAuditPage((p) => Math.max(1, p - 1))} disabled={auditPage === 1}>Previous</Button>
                  <span className="text-xs text-muted-foreground">Page {auditPage} of {auditPageCount}</span>
                  <Button variant="outline" size="sm" onClick={() => setAuditPage((p) => Math.min(auditPageCount, p + 1))} disabled={auditPage >= auditPageCount}>Next</Button>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Data deletion requests</CardTitle>
              <CardDescription>Meta / GDPR compliance queue</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {overview.dataDeletionRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No deletion requests</p>
              ) : (
                overview.dataDeletionRequests.map((d) => (
                  <div key={d.id} className="flex justify-between text-sm py-2 border-b last:border-0">
                    <span>{d.platform} · {d.email ?? 'unknown'}</span>
                    <Badge variant={d.status === 'pending' ? 'destructive' : 'secondary'}>{d.status}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="mt-0 space-y-6">
          <AiKnowledgeCard onOpenIntegrations={() => setSection('integrations')} />
          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Cron jobs</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {cronHealth.length > 0 ? cronHealth.map((item) => {
                  const isSelected = selectedCronKey === item.key;
                  return (
                    <div key={item.key} className="rounded-lg border overflow-hidden">
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full justify-start rounded-none p-0 h-auto"
                        onClick={() => setSelectedCronKey(isSelected ? null : item.key)}
                      >
                        <div className="w-full p-3 text-left">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-sm">{item.name}</span>
                            <Badge variant={item.status === 'healthy' ? 'default' : item.status === 'running' ? 'secondary' : item.status === 'failed' ? 'destructive' : 'outline'} className="capitalize">
                              {item.status}
                            </Badge>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground space-y-1">
                            <div>Enabled: {item.enabled ? 'yes' : 'no'}</div>
                            <div>Last success: {item.lastSuccessAt ? new Date(item.lastSuccessAt).toLocaleString() : 'never'}</div>
                          </div>
                        </div>
                      </Button>
                      {isSelected && (
                        <div className="border-t bg-muted/30 p-3 text-xs space-y-3">
                          <div className="grid gap-1.5 sm:grid-cols-2">
                            <div><span className="text-muted-foreground">Started:</span> {item.lastStartedAt ? new Date(item.lastStartedAt).toLocaleString() : 'never'}</div>
                            <div><span className="text-muted-foreground">Finished:</span> {item.lastFinishedAt ? new Date(item.lastFinishedAt).toLocaleString() : 'never'}</div>
                            <div><span className="text-muted-foreground">Runs:</span> {item.runCount}</div>
                            <div><span className="text-muted-foreground">Last error:</span> {item.lastError || 'none'}</div>
                          </div>
                          <div>
                            <div className="font-medium mb-1">Recent events</div>
                            {item.recentEvents.length > 0 ? (
                              <ul className="space-y-1 list-disc pl-4 text-muted-foreground">
                                {item.recentEvents.map((event) => (
                                  <li key={`${item.key}-${event}`}>{event}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-muted-foreground">No events yet.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }) : [
                  ['Auto-publish', crons.autoPublish],
                  ['Daily workflow', crons.dailyWorkflow],
                  ['Comment sync', crons.commentSync],
                ].map(([name, on]) => (
                  <div key={String(name)} className="flex items-center justify-between text-sm">
                    <span>{name}</span>
                    {on ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Server className="h-4 w-4" /> Integrations</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm"><span>Environment</span><Badge variant="outline">{env.nodeEnv}</Badge></div>
                <MistralKeyRow configured={env.mistralConfigured} onOpenIntegrations={() => setSection('integrations')} />

                <EnvRow label="Meta (Facebook/IG)" ok={env.metaConfigured} />
                <EnvRow label="LinkedIn OAuth" ok={env.linkedInConfigured} />
                <EnvRow label="PawaPay billing" ok={env.pawapayConfigured} />
                <EnvRow label="Meta webhook token" ok={env.metaWebhookTokenSet} />
                <EnvRow label="Widget bundle (CLIENT_URL)" ok={env.widgetBundleConfigured} />
                <div className="flex justify-between text-sm pt-1"><span>Connected social</span><span>{stats.connectedSocialAccounts}</span></div>
                <p className="text-xs text-muted-foreground pt-2">
                  Chatbot widget is served from the client app. Mistral powers RAG, embeddings, and optional workflow escalation.
                </p>
                <p className="text-xs text-muted-foreground pt-2 break-all">API: {env.apiPublicUrl || 'not set'}</p>
                {env.clientUrl && <p className="text-xs text-muted-foreground break-all">Client: {env.clientUrl}</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="company" className="mt-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> About {company.name}</CardTitle>
              <CardDescription>Everything the platform owner needs to know</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 text-sm text-muted-foreground">
              <p><strong className="text-foreground">{company.name}</strong> ({company.product}) is operated by <strong className="text-foreground">{company.operator}</strong> — {company.region}. {company.description}</p>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Support</p>
                  <a href={`mailto:${company.supportEmail}`} className="text-primary hover:underline">{company.supportEmail}</a>
                </div>
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Website</p>
                  <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                    {company.website.replace(/^https?:\/\//, '')} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              <div>
                <h3 className="text-foreground font-semibold mb-2">Product modules</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Brand voice</strong> — company identity, tone, audience, guardrails</li>
                  <li><strong>Posts</strong> — AI copy, campaigns, media library</li>
                  <li><strong>Connections & Scheduler</strong> — OAuth connect, per-platform publish, calendar</li>
                  <li><strong>Leads</strong> — capture, score, and follow up on leads</li>
                  <li><strong>Inbox</strong> — comment sync + AI auto-reply rules</li>
                  <li><strong>AI Chatbot</strong> — RAG-powered assistant with playground, 3D avatar, and TTS</li>
                  <li><strong>Knowledge</strong> — document upload, chunking, and vector search for chatbot context</li>
                  <li><strong>Embeddable Widget</strong> — gradient-themed chat widget with API keys and OpenAPI integration docs</li>
                  <li><strong>Billing</strong> — PawaPay mobile money subscriptions (ZMW)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-foreground font-semibold mb-2">Compliance & legal URLs</h3>
                <p className="text-xs mb-2">
                  The React app serves <Link to="/privacy" className="text-primary hover:underline">/privacy</Link>,{' '}
                  <Link to="/terms" className="text-primary hover:underline">/terms</Link>, and{' '}
                  <Link to="/data-deletion" className="text-primary hover:underline">/data-deletion</Link> for users.
                  Static HTML copies on the API domain ({company.legal.privacy.replace('/privacy', '')}) are required for Meta App Review and stable webhook/legal URLs.
                </p>
                <ul className="space-y-1">
                  <li><Link to={company.legal.privacy} className="text-primary hover:underline">{company.legal.privacy}</Link> — Privacy policy (API HTML)</li>
                  <li><Link to={company.legal.terms} className="text-primary hover:underline">{company.legal.terms}</Link> — Terms of service (API HTML)</li>
                  <li><Link to={company.legal.dataDeletion} className="text-primary hover:underline">{company.legal.dataDeletion}</Link> — Data deletion (Meta App Review)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-foreground font-semibold mb-2">Pricing (ZMW / month)</h3>
                <p className="text-xs mb-2">Edit live pricing in the <strong>Plans</strong> tab — shown here for reference.</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  {(pricingPlans.length ? pricingPlans : [
                    { key: 'free', label: 'Free', priceZmw: 0 },
                    { key: 'starter', label: 'Starter', priceZmw: 375 },
                    { key: 'pro', label: 'Pro', priceZmw: 875 },
                  ]).map((p) => (
                    <div key={p.key} className="rounded-lg border p-3 text-center">
                      <p className="font-medium text-foreground">{p.label}</p>
                      <p className="text-lg font-bold text-foreground">ZMW {p.priceZmw}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border bg-muted/30 p-4 flex items-start gap-3">
                <Zap className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <p><strong className="text-foreground">{company.tagline}</strong> — Mako is built for African agribusiness and growing brands that need enterprise marketing automation without enterprise cost. See <code className="text-xs bg-muted px-1 rounded">mako-api/docs/DEPLOY.md</code> for production deployment.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}

export default function BackofficePage() {
  return (
    <SuperAdminRoute>
      <BackofficeContent />
    </SuperAdminRoute>
  );
}
