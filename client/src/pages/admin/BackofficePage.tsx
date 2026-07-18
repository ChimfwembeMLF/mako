import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, Users, CreditCard, Sparkles, Activity, Server, Settings,
  TrendingUp, Globe, Zap, CheckCircle2, XCircle, Loader2, ArrowLeft,
  FileText, Share2, MessageSquare, ClipboardList, Shield, ExternalLink,
  ChevronRight, Bot, BookOpen, Key,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { SuperAdminRoute } from '@/components/SuperAdminRoute';
import { backofficeApi } from '@/lib/api';
import { BackofficePlansTab } from './BackofficePlansTab';

type Overview = Awaited<ReturnType<typeof backofficeApi.getOverview>>;
type TenantRow = Awaited<ReturnType<typeof backofficeApi.listTenants>>[number];
type TenantDetail = Awaited<ReturnType<typeof backofficeApi.getTenant>>;

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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
    <div className="flex items-end gap-2 h-32">
      {data.map((d) => (
        <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-t-md bg-primary/80 min-h-[4px] transition-all"
            style={{ height: `${(d.count / max) * 100}%` }}
          />
          <span className="text-[10px] text-muted-foreground">{d.month.slice(5)}</span>
          <span className="text-xs font-medium">{d.count}</span>
        </div>
      ))}
    </div>
  );
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
            <div className="mt-6 space-y-6">
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

  const { company, stats, chatbot, planDistribution, aiByFunction, recentDeposits, recentTenants, crons, env } = overview;

  return (
    <div className="w-full space-y-6 sm:space-y-8 pb-8 sm:pb-10 min-w-0">
      <TenantDetailSheet tenantId={selectedTenantId} open={sheetOpen} onOpenChange={setSheetOpen} />

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link to="/dashboard" className="hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
            </Link>
            <span>/</span>
            <span>Platform Backoffice</span>
          </div>
          <h1 className="text-3xl font-bold font-display">{company.product}</h1>
          <p className="text-muted-foreground mt-1">{company.tagline} — operated by {company.operator}</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/system"><Settings className="h-4 w-4 mr-2" /> System settings</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/queues"><Activity className="h-4 w-4 mr-2" /> Job queues</Link>
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tenants">Tenants ({stats.tenants})</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="ai">AI Usage</TabsTrigger>
          <TabsTrigger value="chatbot">Chatbot ({stats.chatSessions})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="health">Platform Health</TabsTrigger>
          <TabsTrigger value="company">About Mako </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Tenants" value={stats.tenants} icon={Building2} />
            <StatCard label="Users" value={stats.users} icon={Users} sub={`${stats.activeMembers} active members`} />
            <StatCard label="Est. MRR" value={`ZMW ${stats.estimatedMrrZmw}`} icon={TrendingUp} />
            <StatCard label="Publications" value={stats.publications} icon={Share2} sub={`${stats.contentItems} content items`} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Leads captured" value={stats.leads} icon={MessageSquare} />
            <StatCard label="Comment replies" value={stats.commentReplies} icon={MessageSquare} />
            <StatCard label="Audit events" value={stats.auditLogs} icon={ClipboardList} />
            <StatCard label="Pending deletions" value={stats.pendingDataDeletions} icon={Shield} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Chat sessions" value={stats.chatSessions} icon={Bot} sub={`${stats.chatSessionsLast7Days} last 7 days`} />
            <StatCard label="Chat messages" value={stats.chatMessages} icon={MessageSquare} />
            <StatCard label="Knowledge docs" value={stats.knowledgeDocuments} icon={BookOpen} sub={`${stats.knowledgeReady} ready · ${stats.knowledgeFailed} failed`} />
            <StatCard label="Widgets live" value={stats.widgetsEnabled} icon={Globe} sub={`${stats.chatbotConfigs} configs · ${stats.activeChatbotApiKeys} API keys`} />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Tenant growth</CardTitle></CardHeader>
              <CardContent>
                {overview.tenantGrowth.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No growth data yet</p>
                ) : (
                  <GrowthBars data={overview.tenantGrowth} />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Recent tenants</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {recentTenants.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tenants yet</p>
                ) : (
                  recentTenants.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => openTenant(t.id)}
                      className="flex w-full justify-between text-sm border-b pb-2 last:border-0 hover:bg-muted/50 rounded px-1 -mx-1 text-left"
                    >
                      <div>
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.ownerEmail ?? t.slug}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tenants" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>All tenants</CardTitle>
              <CardDescription>Click a row to view workspace details</CardDescription>
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
                    <th className="pb-2 pr-4">Widget</th>
                    <th className="pb-2 pr-4">Sessions</th>
                    <th className="pb-2">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => (
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

        <TabsContent value="revenue" className="space-y-6 mt-6">
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
                    <span>{d.plan ?? '—'} · {d.amount} {d.currency}</span>
                    <Badge variant={d.status === 'completed' ? 'default' : 'secondary'}>{d.status}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="mt-6">
          <BackofficePlansTab onSaved={setPricingPlans} />
        </TabsContent>

        <TabsContent value="ai" className="space-y-6 mt-6">
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

        <TabsContent value="chatbot" className="space-y-6 mt-6">
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

        <TabsContent value="activity" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent audit events</CardTitle>
              <CardDescription>Platform-wide governance trail</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {overview.recentAudit.length === 0 ? (
                <p className="text-sm text-muted-foreground">No audit events yet</p>
              ) : (
                overview.recentAudit.map((a) => (
                  <div key={a.id} className="flex justify-between gap-4 text-sm py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{a.action} · {a.resourceType}</p>
                      <p className="text-xs text-muted-foreground">{a.tenantName ?? '—'} · {a.userEmail ?? '—'}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                ))
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

        <TabsContent value="health" className="space-y-6 mt-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Cron jobs</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {[
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
                <EnvRow label="Mistral AI" ok={env.mistralConfigured} />
                <EnvRow label="Supabase storage" ok={env.supabaseConfigured} />
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

        <TabsContent value="company" className="mt-6 space-y-6">
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
                  <li><strong>Brand Brain</strong> — company identity, tone, audience, guardrails</li>
                  <li><strong>Content Engine</strong> — AI copy, campaigns, media library</li>
                  <li><strong>Connections & Scheduler</strong> — OAuth connect, per-platform publish, calendar</li>
                  <li><strong>Leads</strong> — capture, score, and follow up on leads</li>
                  <li><strong>Social Inbox</strong> — comment sync + AI auto-reply rules</li>
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
  );
}

export default function BackofficePage() {
  return (
    <SuperAdminRoute>
      <BackofficeContent />
    </SuperAdminRoute>
  );
}
