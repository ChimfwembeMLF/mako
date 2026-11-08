import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, Code2, Loader2, Pause, Play, Plus, RotateCw } from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { Button } from '../components/ui/button';
import { CreateCampaignSheet } from './CreateCampaignSheet';
import { adsApi, paymentsApi } from '../lib/api';
import { MobileMoneyPaymentForm } from '@/components/MobileMoneyPaymentForm';
import { createDefaultMobileMoneyPayment } from '@/lib/payment-countries';
import { useFxQuoteToZmw } from '@/hooks/useFxQuote';
import { useWorkspace } from '../hooks/useWorkspace';
import { useTenant } from '../hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/lib/permissions';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TenantBillingRecords } from '@/components/TenantBillingRecords';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const DEFAULT_ADS_TOPUP_ZMW = 500;
const QUICK_TOPUPS_ZMW = [200, 500, 1000, 2500];

type Platform = 'META' | 'GOOGLE' | 'TIKTOK' | 'LINKEDIN' | 'PINTEREST' | 'TABOOLA' | 'X' | 'EMBED';
type Status = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'FAILED';

interface AdCampaign {
  id: string;
  name: string;
  platform: Platform;
  dailyBudget: number | string;
  status: Status;
  platformCampaignId?: string;
  targetAudience?: string | null;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: string;
  creative?: { headline: string; body: string; mediaUrl?: string | null } | null;
}

type Metrics = { spend: number; impressions: number; clicks: number };

const PLATFORM_LABEL: Record<Platform, string> = {
  META: 'Facebook & Instagram',
  GOOGLE: 'Google',
  TIKTOK: 'TikTok',
  LINKEDIN: 'LinkedIn',
  PINTEREST: 'Pinterest',
  TABOOLA: 'Taboola',
  X: 'X',
  EMBED: 'Your website',
};

const STATUS: Record<Status, { label: string; dot: string; text: string }> = {
  ACTIVE: { label: 'Running', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
  PAUSED: { label: 'Paused', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  DRAFT: { label: 'Draft', dot: 'bg-muted-foreground/50', text: 'text-muted-foreground' },
  COMPLETED: { label: 'Ended', dot: 'bg-muted-foreground/50', text: 'text-muted-foreground' },
  FAILED: { label: 'Didn’t launch', dot: 'bg-destructive', text: 'text-destructive' },
};

type Filter = 'all' | 'ACTIVE' | 'DRAFT' | 'PAUSED' | 'FAILED';

const zmw = (n: number) =>
  `K${n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const compact = (n: number) => new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);

export default function AdsPage() {
  const { activeWorkspace } = useWorkspace();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const { can } = usePermissions();
  // Topping up spends the organization's money, so it needs billing access.
  const canBill = can(P.settings.billing);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [balance, setBalance] = useState<number>(0);
  const [stats, setStats] = useState({ activeCampaigns: 0, totalSpend: 0, totalImpressions: 0 });
  const [filter, setFilter] = useState<Filter>('all');
  const [actionId, setActionId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Record<string, Metrics | 'loading' | 'error'>>({});

  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number>(DEFAULT_ADS_TOPUP_ZMW);
  const [topUpPayment, setTopUpPayment] = useState(createDefaultMobileMoneyPayment);
  const [isToppingUp, setIsToppingUp] = useState(false);
  const { quote: topUpFxToZmw, loading: topUpFxLoading } = useFxQuoteToZmw(topUpAmount, topUpPayment.currency);

  useEffect(() => {
    if (!isTopUpOpen) return;
    if (topUpPayment.currency === 'ZMW') {
      setTopUpAmount(DEFAULT_ADS_TOPUP_ZMW);
      return;
    }
    paymentsApi
      .fxQuoteFromZmw(DEFAULT_ADS_TOPUP_ZMW, topUpPayment.currency)
      .then((quote) => setTopUpAmount(Number(quote.amount)))
      .catch(() => setTopUpAmount(DEFAULT_ADS_TOPUP_ZMW));
  }, [isTopUpOpen, topUpPayment.currency]);

  const notify = useCallback(
    (title: string, description?: string, failed = false) =>
      toast({ title, description, variant: failed ? 'destructive' : undefined }),
    [toast],
  );

  const loadData = useCallback(async () => {
    // Campaigns belong to a workspace; wait until we know which one.
    if (!tenant || !activeWorkspace) return;
    setLoading(true);
    try {
      const [bal, list, dash] = await Promise.all([
        adsApi.getBalance(tenant.id),
        adsApi.getCampaigns(tenant.id, activeWorkspace),
        adsApi.getDashboardStats(tenant.id, activeWorkspace),
      ]);
      setBalance(Number(bal.balance) || 0);
      setCampaigns(list as AdCampaign[]);
      setStats(dash);
    } catch (err) {
      notify('Could not load your ads', err instanceof Error ? err.message : undefined, true);
    } finally {
      setLoading(false);
    }
  }, [tenant, activeWorkspace, notify]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const counts = useMemo(() => {
    const c = { all: campaigns.length, ACTIVE: 0, DRAFT: 0, PAUSED: 0, FAILED: 0 } as Record<Filter, number>;
    for (const x of campaigns) if (x.status in c) c[x.status as Filter] += 1;
    return c;
  }, [campaigns]);

  const visible = useMemo(
    () => (filter === 'all' ? campaigns : campaigns.filter((c) => c.status === filter)),
    [campaigns, filter],
  );

  async function handleTopUpSubmit() {
    if (!tenant || !activeWorkspace) return notify('Choose a workspace first', undefined, true);
    if (!topUpAmount || topUpAmount <= 0) return notify('Enter an amount above 0', undefined, true);
    if (!topUpPayment.phone.trim()) return notify('Enter your Mobile Money number', undefined, true);
    setIsToppingUp(true);
    try {
      const res = await paymentsApi.initiateAdsDeposit({
        tenantId: tenant.id,
        amount: topUpAmount,
        phone: topUpPayment.phone.trim(),
        correspondent: topUpPayment.correspondent,
        paymentCountryId: topUpPayment.paymentCountryId,
        currency: topUpPayment.currency,
        countryCode: topUpPayment.countryCode,
      });
      notify(res.activated ? 'Balance topped up' : 'Check your phone', res.message);
      if (res.activated) {
        const bal = await adsApi.getBalance(tenant.id);
        setBalance(Number(bal.balance) || 0);
      }
      setIsTopUpOpen(false);
    } catch (err) {
      notify('Top up failed', err instanceof Error ? err.message : undefined, true);
    } finally {
      setIsToppingUp(false);
    }
  }

  async function runAction(id: string, fn: () => Promise<unknown>, done: string, failed: string) {
    setActionId(id);
    try {
      await fn();
      notify(done);
      await loadData();
    } catch (err) {
      notify(failed, err instanceof Error ? err.message : undefined, true);
    } finally {
      setActionId(null);
    }
  }

  async function toggleResults(c: AdCampaign) {
    if (openId === c.id) return setOpenId(null);
    setOpenId(c.id);
    if (!tenant || metrics[c.id] === 'loading' || typeof metrics[c.id] === 'object') return;
    if (c.status === 'DRAFT' || c.status === 'FAILED') return;
    setMetrics((m) => ({ ...m, [c.id]: 'loading' }));
    try {
      const res = await adsApi.getMetrics(tenant.id, c.id);
      setMetrics((m) => ({ ...m, [c.id]: res }));
    } catch {
      setMetrics((m) => ({ ...m, [c.id]: 'error' }));
    }
  }

  async function copyEmbed(c: AdCampaign) {
    if (!tenant) return;
    try {
      const { snippet } = await adsApi.getEmbedScript(tenant.id, c.id);
      await navigator.clipboard.writeText(snippet);
      notify('Embed code copied', 'Paste it into your website where the ad should appear.');
    } catch (err) {
      notify('Could not copy the embed code', err instanceof Error ? err.message : undefined, true);
    }
  }

  const filters: Array<{ key: Filter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'ACTIVE', label: 'Running' },
    { key: 'PAUSED', label: 'Paused' },
    { key: 'DRAFT', label: 'Drafts' },
    { key: 'FAILED', label: 'Didn’t launch' },
  ];

  return (
    <PageContainer>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">Ads</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Write ads with AI, run them on social or your website, and pay from one prepaid balance.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-1.5 self-start sm:self-auto">
          <Plus className="h-4 w-4" /> New campaign
        </Button>
      </div>

      {/* Balance + headline numbers */}
      <section className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
        <div className="flex flex-col justify-between gap-5 rounded-2xl bg-foreground p-5 text-background sm:p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-background/60">Ads balance</p>
            <p className="mt-2 font-display text-4xl font-semibold tabular-nums">
              {loading ? <span className="inline-block h-9 w-32 animate-pulse rounded bg-background/15" /> : zmw(balance)}
            </p>
            <p className="mt-1 text-xs text-background/60">
              {balance <= 0 ? 'Top up to launch paid campaigns.' : 'Spent as your campaigns run. Website ads are free.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canBill ? (
            <Button
              size="sm"
              onClick={() => {
                setTopUpPayment(createDefaultMobileMoneyPayment());
                setIsTopUpOpen(true);
              }}
              className="h-9 bg-background text-foreground hover:bg-background/90"
            >
              Top up
            </Button>
            ) : null}
            <span className="text-[11px] text-background/50">
              {canBill ? 'Mobile Money · balance kept in ZMW' : 'Ask someone with billing access to top up.'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x divide-border rounded-2xl border bg-card">
          {[
            { label: 'Running now', value: String(stats.activeCampaigns), hint: `${counts.all} campaign${counts.all === 1 ? '' : 's'} in total` },
            { label: 'Spent', value: zmw(Number(stats.totalSpend) || 0), hint: 'across paid channels' },
            {
              label: 'Impressions',
              value: compact(Number(stats.totalImpressions) || 0),
              hint: 'times your ads were shown',
            },
          ].map((s) => (
            <div key={s.label} className="flex min-w-0 flex-col justify-between gap-3 p-4 sm:p-5">
              <p className="truncate text-xs font-medium text-muted-foreground">{s.label}</p>
              <div>
                <p className="truncate font-display text-xl font-semibold tabular-nums sm:text-3xl">
                  {loading ? <span className="inline-block h-7 w-14 animate-pulse rounded bg-muted" /> : s.value}
                </p>
                <p className="mt-1 hidden truncate text-[11px] text-muted-foreground sm:block">{s.hint}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Tabs defaultValue="campaigns" className="mt-8">
        <TabsList className="h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-0 border-b border-border bg-transparent p-0">
          {[
            { value: 'campaigns', label: 'Campaigns' },
            ...(canBill ? [{ value: 'history', label: 'Top-up history' }] : []),
          ].map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="-mb-px h-10 rounded-none border-b-2 border-transparent bg-transparent px-0 text-sm font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="campaigns" className="mt-5">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[76px] animate-pulse rounded-xl border bg-card/60" />
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="grid gap-6 rounded-2xl border border-dashed bg-card/60 p-6 sm:p-10 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <h3 className="font-display text-lg font-semibold">Launch your first ad</h3>
                <ol className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3 sm:gap-6">
                  {[
                    ['01', 'Describe what you’re promoting; AI writes the ad.'],
                    ['02', 'Pick where it runs: social, Google or your own website.'],
                    ['03', 'Set a daily budget and launch. Pause anytime.'],
                  ].map(([n, t]) => (
                    <li key={n} className="flex gap-2.5">
                      <span className="font-mono text-xs font-semibold text-primary">{n}</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <Button onClick={() => setIsCreateOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" /> New campaign
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
                {filters
                  .filter((f) => f.key === 'all' || counts[f.key] > 0)
                  .map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setFilter(f.key)}
                      className={cn(
                        'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                        filter === f.key ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {f.label}
                      <span className={cn('ml-1.5 tabular-nums', filter === f.key ? 'text-background/60' : 'text-muted-foreground/70')}>
                        {counts[f.key]}
                      </span>
                    </button>
                  ))}
              </div>

              <div className="overflow-hidden rounded-2xl border bg-card">
                <div className="hidden grid-cols-[minmax(0,1fr)_170px_120px_120px_36px] gap-4 border-b px-5 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid">
                  <span>Campaign</span>
                  <span>Runs on</span>
                  <span>Status</span>
                  <span className="text-right">Daily budget</span>
                  <span />
                </div>
                <ul className="divide-y">
                  {visible.map((c) => {
                    const st = STATUS[c.status] ?? STATUS.DRAFT;
                    const open = openId === c.id;
                    const busy = actionId === c.id;
                    const m = metrics[c.id];
                    const budget = Number(c.dailyBudget) || 0;
                    return (
                      <li key={c.id}>
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,1fr)_170px_120px_120px_36px]">
                          <button type="button" onClick={() => void toggleResults(c)} className="min-w-0 text-left">
                            <p className="truncate text-sm font-medium">{c.name}</p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {c.creative?.headline ?? c.targetAudience ?? 'No ad copy yet'}
                            </p>
                          </button>
                          <span className="hidden truncate text-sm text-foreground/80 md:block">{PLATFORM_LABEL[c.platform] ?? c.platform}</span>
                          <span className={cn('flex items-center gap-1.5 text-xs font-medium md:text-sm', st.text)}>
                            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', st.dot)} aria-hidden />
                            {st.label}
                          </span>
                          <span className="col-span-2 flex items-center justify-between text-xs text-muted-foreground md:col-span-1 md:block md:text-right md:text-sm md:text-foreground md:tabular-nums">
                            <span className="md:hidden">{PLATFORM_LABEL[c.platform] ?? c.platform}</span>
                            <span>{c.platform === 'EMBED' ? 'Free' : `${zmw(budget)}/day`}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => void toggleResults(c)}
                            className="hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:flex"
                            aria-expanded={open}
                            aria-label={open ? `Hide ${c.name} details` : `Show ${c.name} details`}
                          >
                            <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
                          </button>
                        </div>

                        {open && (
                          <div className="grid gap-5 border-t bg-muted/25 px-4 py-5 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Ad</p>
                              {c.creative ? (
                                <div className="mt-2 flex gap-3 rounded-xl border bg-card p-3">
                                  {c.creative.mediaUrl && (
                                    <img src={c.creative.mediaUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold">{c.creative.headline}</p>
                                    <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{c.creative.body}</p>
                                  </div>
                                </div>
                              ) : (
                                <p className="mt-2 text-sm text-muted-foreground">No ad copy saved.</p>
                              )}
                              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                                {c.targetAudience && (<><dt className="text-muted-foreground">Audience</dt><dd className="truncate">{c.targetAudience}</dd></>)}
                                {c.location && (<><dt className="text-muted-foreground">Location</dt><dd className="truncate">{c.location}</dd></>)}
                                {(c.startDate || c.endDate) && (<><dt className="text-muted-foreground">Dates</dt><dd>{[c.startDate, c.endDate].filter(Boolean).join(' – ')}</dd></>)}
                                {c.createdAt && (<><dt className="text-muted-foreground">Created</dt><dd>{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</dd></>)}
                              </dl>
                            </div>

                            <div className="flex min-w-0 flex-col justify-between gap-4">
                              <div>
                                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Results</p>
                                {c.status === 'DRAFT' || c.status === 'FAILED' ? (
                                  <p className="mt-2 text-sm text-muted-foreground">
                                    {c.status === 'FAILED' ? 'This campaign didn’t launch. Fix anything flagged and try again.' : 'Results appear once the campaign is live.'}
                                  </p>
                                ) : m === 'loading' || m === undefined ? (
                                  <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading results…</p>
                                ) : m === 'error' ? (
                                  <p className="mt-2 text-sm text-destructive">Couldn’t load results right now.</p>
                                ) : (
                                  <div className="mt-2 grid grid-cols-4 gap-2">
                                    {[
                                      ['Spent', zmw(m.spend)],
                                      ['Shown', compact(m.impressions)],
                                      ['Clicks', compact(m.clicks)],
                                      ['Click rate', m.impressions ? `${((m.clicks / m.impressions) * 100).toFixed(1)}%` : '—'],
                                    ].map(([k, v]) => (
                                      <div key={k} className="rounded-lg border bg-card p-2.5">
                                        <p className="text-[10px] text-muted-foreground">{k}</p>
                                        <p className="mt-0.5 font-display text-base font-semibold tabular-nums">{v}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {(c.status === 'DRAFT' || c.status === 'FAILED') && (
                                  <Button
                                    size="sm"
                                    className="h-8 gap-1.5 text-xs"
                                    disabled={busy}
                                    onClick={() => void runAction(c.id, () => adsApi.publishCampaign(tenant!.id, c.id), 'Campaign launched', 'Could not launch the campaign')}
                                  >
                                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : c.status === 'FAILED' ? <RotateCw className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                                    {c.status === 'FAILED' ? 'Try again' : 'Launch'}
                                  </Button>
                                )}
                                {c.status === 'ACTIVE' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 gap-1.5 text-xs"
                                    disabled={busy}
                                    onClick={() => void runAction(c.id, () => adsApi.pauseCampaign(tenant!.id, c.id), 'Campaign paused', 'Could not pause the campaign')}
                                  >
                                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />}
                                    Pause
                                  </Button>
                                )}
                                {c.platform === 'EMBED' && c.platformCampaignId && c.status === 'ACTIVE' && (
                                  <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => void copyEmbed(c)}>
                                    <Code2 className="h-3.5 w-3.5" /> Copy embed code
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-5">
          {tenant?.id && canBill && <TenantBillingRecords tenantId={tenant.id} filterPlan="ADS_TOPUP" />}
        </TabsContent>
      </Tabs>

      <CreateCampaignSheet open={isCreateOpen} onOpenChange={setIsCreateOpen} onSuccess={loadData} />

      <Dialog open={isTopUpOpen} onOpenChange={setIsTopUpOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Top up ads balance</DialogTitle>
            <DialogDescription>You’ll get a Mobile Money prompt on your phone to approve the payment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label htmlFor="topup-amount" className="mb-1.5 block text-sm font-medium">
                Amount ({topUpPayment.currency})
              </label>
              {topUpPayment.currency === 'ZMW' && (
                <div className="mb-2 grid grid-cols-4 gap-2">
                  {QUICK_TOPUPS_ZMW.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setTopUpAmount(v)}
                      className={cn(
                        'rounded-lg border py-2 text-sm font-medium tabular-nums transition-colors',
                        topUpAmount === v ? 'border-foreground bg-foreground text-background' : 'hover:bg-muted',
                      )}
                    >
                      {zmw(v)}
                    </button>
                  ))}
                </div>
              )}
              <input
                id="topup-amount"
                type="number"
                min="1"
                inputMode="decimal"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(Number(e.target.value))}
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {topUpPayment.currency !== 'ZMW' && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {topUpFxLoading
                    ? 'Working out the ZMW amount…'
                    : topUpFxToZmw
                      ? `Adds about ${zmw(Number(topUpFxToZmw.amountZmw))} to your balance.`
                      : 'Enter an amount to see what it adds in ZMW.'}
                </p>
              )}
            </div>
            <MobileMoneyPaymentForm value={topUpPayment} onChange={setTopUpPayment} disabled={isToppingUp} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTopUpOpen(false)} disabled={isToppingUp}>
              Cancel
            </Button>
            <Button onClick={() => void handleTopUpSubmit()} disabled={isToppingUp} className="gap-1.5">
              {isToppingUp && <Loader2 className="h-4 w-4 animate-spin" />}
              {isToppingUp ? 'Sending prompt…' : `Pay ${topUpPayment.currency === 'ZMW' ? zmw(topUpAmount || 0) : `${topUpAmount || 0} ${topUpPayment.currency}`}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
