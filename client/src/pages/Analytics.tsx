import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownRight, ArrowUpRight, Minus, Eye, Heart, Percent, Send, Loader2, RefreshCw, Sparkles,
  ArrowUp, ArrowDown, Users, LineChart as LineChartIcon, Table2,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/use-toast";
import {
  analyticsApi, contentItemsApi, contentPublicationsApi, leadsApi,
  type PerformanceReport, type PerformanceTotals, type PlatformDashboardRow,
} from "@/lib/api";
import { platformOf } from "@/lib/platforms";
import { mapApiItemToPost } from "@/lib/scheduler-post";
import { getPostDisplayStatus, POST_STATUS_META, type PostDisplayStatus } from "@/lib/post-status";
import { cn } from "@/lib/utils";

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];
type TrendMetric = "engagements" | "views" | "posts";

const TREND_LABEL: Record<TrendMetric, string> = { engagements: "Engagements", views: "Views", posts: "Posts published" };

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const fmt = (n: number) => (n >= 10_000 ? compact.format(n) : n.toLocaleString());
const engagementsOf = (t: PerformanceTotals) => t.likes + t.comments + t.shares;
const rateOf = (t: PerformanceTotals) => (t.views > 0 ? engagementsOf(t) / t.views : null);

/** Percentage change, or null when there is nothing to compare against. */
function change(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}

function Delta({ value, days }: { value: number | null; days: number }) {
  if (value === null) return <span className="text-xs text-muted-foreground">New this period</span>;
  const pct = Math.round(value * 100);
  const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        pct > 0 ? "text-green-700 dark:text-green-400" : pct < 0 ? "text-red-700 dark:text-red-400" : "text-muted-foreground",
      )}
      title={`Compared with the previous ${days} days`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {pct > 0 ? "+" : ""}{pct}%
      <span className="ml-1 font-normal text-muted-foreground">vs previous {days}d</span>
    </span>
  );
}

/**
 * SVG colour attributes can't read CSS variables, so resolve the chart tokens to real
 * colours and refresh them when the theme class changes.
 */
function useChartColor(token: string, fallback: string) {
  const read = () => getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback;
  const [color, setColor] = useState(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setColor(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  return color;
}

function KpiTile({ label, value, icon: Icon, delta, hint }: {
  label: string; value: string; icon: typeof Eye; delta: React.ReactNode; hint?: string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="space-y-2 p-5">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span title={hint}>{label}</span>
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <p className="font-display text-3xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
        {delta}
      </CardContent>
    </Card>
  );
}

function TrendTooltip({ active, payload, metric }: { active?: boolean; payload?: Array<{ payload: { date: string } & Record<TrendMetric, number> }>; metric: TrendMetric }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{new Date(`${row.date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</p>
      <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-[var(--chart-1)]" />
        {TREND_LABEL[metric]}: <span className="font-semibold tabular-nums text-foreground">{row[metric].toLocaleString()}</span>
      </p>
      {metric !== "posts" && <p className="text-muted-foreground">{row.posts} post{row.posts === 1 ? "" : "s"} published</p>}
    </div>
  );
}

type AiReport = {
  summary?: string;
  topPerformingTraits?: string[];
  underperformingTraits?: string[];
  contentRecommendations?: string[];
  optimalPostingTimes?: string[];
};

const Analytics = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { activeWorkspace, workspaces, workspaceVersion } = useWorkspace();
  const { toast } = useToast();
  const workspaceName = workspaces.find((w) => w.id === activeWorkspace)?.name;
  const seriesColor = useChartColor("--chart-1", "#2a78d6");

  const [range, setRange] = useState<Range>(30);
  const [metric, setMetric] = useState<TrendMetric>("engagements");
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [accounts, setAccounts] = useState<PlatformDashboardRow[]>([]);
  const [pipeline, setPipeline] = useState<Partial<Record<PostDisplayStatus, number>>>({});
  const [leads, setLeads] = useState({ total: 0, hot: 0, warm: 0, cold: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [aiReport, setAiReport] = useState<AiReport | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFailed, setAiFailed] = useState(false);

  const loadReport = useCallback(async () => {
    if (!tenant?.id || !activeWorkspace) return;
    const data = await analyticsApi.getPerformance(tenant.id, range, activeWorkspace).catch(() => null);
    setReport(data);
  }, [tenant?.id, activeWorkspace, range]);

  // Range-independent data: connected accounts, the posting pipeline and leads. Team-wide, not just the viewer's posts.
  const loadContext = useCallback(async () => {
    if (!tenant?.id || !activeWorkspace) return;
    const [dash, items, leadList] = await Promise.all([
      analyticsApi.getPlatformDashboard(tenant.id, activeWorkspace).catch(() => null),
      contentItemsApi.findAll(tenant.id, { workspaceId: activeWorkspace }).catch(() => []),
      leadsApi.findAll(tenant.id, activeWorkspace).catch(() => []),
    ]);
    setAccounts(dash?.platforms ?? []);
    const counts: Partial<Record<PostDisplayStatus, number>> = {};
    for (const item of Array.isArray(items) ? items : []) {
      const key = getPostDisplayStatus(mapApiItemToPost(item as Record<string, unknown>));
      counts[key] = (counts[key] ?? 0) + 1;
    }
    setPipeline(counts);
    const ls = (Array.isArray(leadList) ? leadList : []) as Array<{ classification?: string }>;
    setLeads({
      total: ls.length,
      hot: ls.filter((l) => l.classification === "hot").length,
      warm: ls.filter((l) => l.classification === "warm").length,
      cold: ls.filter((l) => l.classification === "cold").length,
    });
  }, [tenant?.id, activeWorkspace]);

  useEffect(() => {
    if (!user || !activeWorkspace) return;
    setLoading(true);
    void Promise.all([loadReport(), loadContext()]).finally(() => setLoading(false));
    // loadContext doesn't depend on range; loadReport does and is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeWorkspace, workspaceVersion, loadContext]);

  useEffect(() => {
    if (user && activeWorkspace && !loading) void loadReport();
    // Only re-run when the range changes after the first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const syncEngagement = async () => {
    if (!tenant?.id || !activeWorkspace) return;
    setSyncing(true);
    try {
      const { updated } = await contentPublicationsApi.syncEngagement(tenant.id, activeWorkspace);
      await loadReport();
      toast({ title: "Engagement synced", description: updated > 0 ? `Updated ${updated} post${updated === 1 ? "" : "s"}.` : "Everything is up to date." });
    } catch (err) {
      toast({ title: "Sync failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const runAiReport = async () => {
    if (!tenant?.id) return;
    setAiLoading(true);
    setAiFailed(false);
    try {
      const data = await analyticsApi.getAiReport(tenant.id, activeWorkspace ?? undefined);
      setAiReport(data);
      if (!data) setAiFailed(true);
    } catch {
      setAiFailed(true);
    } finally {
      setAiLoading(false);
    }
  };

  const current = report?.current;
  const previous = report?.previous;
  const engagements = current ? engagementsOf(current) : 0;
  const rate = current ? rateOf(current) : null;
  const prevRate = previous ? rateOf(previous) : null;
  const hasData = Boolean(current && (current.posts > 0 || (previous?.posts ?? 0) > 0));

  const trendData = useMemo(() => report?.daily ?? [], [report]);
  const maxPlatformEngagement = Math.max(1, ...(report?.byPlatform ?? []).map(engagementsOf));
  const connectedAccounts = accounts.filter((a) => a.connected);
  const mix = current
    ? [
        { key: "likes", label: "Likes", value: current.likes, color: "var(--chart-1)" },
        { key: "comments", label: "Comments", value: current.comments, color: "var(--chart-2)" },
        { key: "shares", label: "Shares", value: current.shares, color: "var(--chart-3)" },
      ]
    : [];

  return (
    <div className="w-full min-w-0 space-y-6 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            How {workspaceName ?? "your workspace"}'s published posts are performing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-border bg-card p-1" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={range === r}
                onClick={() => setRange(r)}
                className={cn(
                  "h-8 rounded-full px-3 text-xs font-semibold transition-colors",
                  range === r ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r} days
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="h-10 gap-1.5 rounded-full" onClick={syncEngagement} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync latest numbers
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : (
        <>
          {!hasData && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">No published posts in the last {range} days</p>
                  <p className="text-sm text-muted-foreground">
                    {connectedAccounts.length === 0
                      ? "Connect a social account and publish a post to start seeing results here."
                      : "Publish or schedule posts, then sync the latest numbers to see how they do."}
                  </p>
                </div>
                <Button asChild>
                  <Link to={connectedAccounts.length === 0 ? "/publisher" : "/scheduler"}>
                    {connectedAccounts.length === 0 ? "Connect an account" : "Go to Schedule"}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {current && previous && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiTile label="Views" value={fmt(current.views)} icon={Eye} delta={<Delta value={change(current.views, previous.views)} days={range} />} />
              <KpiTile label="Engagements" hint="Likes, comments and shares" value={fmt(engagements)} icon={Heart} delta={<Delta value={change(engagements, engagementsOf(previous))} days={range} />} />
              <KpiTile
                label="Engagement rate"
                hint="Engagements divided by views"
                value={rate === null ? "—" : `${(rate * 100).toFixed(1)}%`}
                icon={Percent}
                delta={
                  rate === null
                    ? <span className="text-xs text-muted-foreground">Needs view counts</span>
                    : <Delta value={prevRate === null ? null : change(rate, prevRate)} days={range} />
                }
              />
              <KpiTile label="Posts published" hint="One per platform a post went out on" value={fmt(current.posts)} icon={Send} delta={<Delta value={change(current.posts, previous.posts)} days={range} />} />
            </div>
          )}

          {report && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="min-w-0 border-border/60 lg:col-span-2">
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-base">{TREND_LABEL[metric]} over time</CardTitle>
                    <CardDescription>Totals for posts published each day.</CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="flex rounded-md border border-border p-0.5" role="group" aria-label="Metric">
                      {(Object.keys(TREND_LABEL) as TrendMetric[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          aria-pressed={metric === m}
                          onClick={() => setMetric(m)}
                          className={cn("rounded px-2.5 py-1 text-xs font-medium", metric === m ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
                        >
                          {m === "posts" ? "Posts" : TREND_LABEL[m]}
                        </button>
                      ))}
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable} title={showTable ? "Show chart" : "Show as table"}>
                      {showTable ? <LineChartIcon className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="min-w-0">
                  {showTable ? (
                    <div className="max-h-72 overflow-y-auto rounded-md border border-border/60">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                          <tr><th className="px-3 py-2 font-medium">Date</th><th className="px-3 py-2 text-right font-medium">Posts</th><th className="px-3 py-2 text-right font-medium">Views</th><th className="px-3 py-2 text-right font-medium">Engagements</th></tr>
                        </thead>
                        <tbody>
                          {[...trendData].reverse().map((d) => (
                            <tr key={d.date} className="border-t border-border/50">
                              <td className="px-3 py-1.5">{new Date(`${d.date}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums">{d.posts}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums">{d.views.toLocaleString()}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums">{d.engagements.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={280} minWidth={0}>
                      <BarChart data={trendData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barCategoryGap={2}>
                        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="0" />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          minTickGap={24}
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          tickFormatter={(v: string) => new Date(`${v}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                          width={48}
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          tickFormatter={(v: number) => (v >= 1000 ? compact.format(v) : String(v))}
                        />
                        <Tooltip content={<TrendTooltip metric={metric} />} cursor={{ fill: "hsl(var(--muted))" }} />
                        {/* Posts go out on scattered days, so daily totals read as bars rather than a spiky line. */}
                        <Bar dataKey={metric} fill={seriesColor} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">What people did</CardTitle>
                  <CardDescription>How engagement splits across likes, comments and shares.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {engagements === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No engagement recorded in this period yet.</p>
                  ) : (
                    <>
                      <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded" role="img" aria-label={mix.map((m) => `${m.label} ${m.value}`).join(", ")}>
                        {mix.filter((m) => m.value > 0).map((m) => (
                          <div key={m.key} style={{ width: `${(m.value / engagements) * 100}%`, background: m.color }} title={`${m.label}: ${m.value.toLocaleString()}`} />
                        ))}
                      </div>
                      <ul className="space-y-3">
                        {mix.map((m) => (
                          <li key={m.key} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2 text-muted-foreground">
                              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: m.color }} aria-hidden />
                              {m.label}
                            </span>
                            <span className="tabular-nums">
                              <span className="font-semibold text-foreground">{m.value.toLocaleString()}</span>
                              <span className="ml-2 text-muted-foreground">{Math.round((m.value / engagements) * 100)}%</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <div className="border-t border-border/60 pt-4 text-sm">
                    <p className="text-muted-foreground">Average per post</p>
                    <p className="mt-1 font-display text-2xl font-bold tabular-nums">
                      {current && current.posts > 0 ? fmt(Math.round(engagements / current.posts)) : "—"}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">engagements</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {report && (
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">By platform</CardTitle>
                <CardDescription>Last {range} days, ranked by engagements.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {report.byPlatform.length === 0 && connectedAccounts.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No platforms connected yet.</p>
                ) : (
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="pb-2 font-medium">Platform</th>
                        <th className="pb-2 text-right font-medium">Posts</th>
                        <th className="pb-2 text-right font-medium">Views</th>
                        <th className="w-[34%] pb-2 pl-6 font-medium">Engagements</th>
                        <th className="pb-2 text-right font-medium">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ...report.byPlatform,
                        // Connected platforms with nothing published still get a row, so gaps are visible.
                        ...connectedAccounts
                          .filter((a) => !report.byPlatform.some((p) => p.platform === a.platform))
                          .map((a) => ({ platform: a.platform, posts: 0, views: 0, likes: 0, comments: 0, shares: 0 })),
                      ].map((p) => {
                        const def = platformOf(p.platform);
                        const Icon = def.icon;
                        const e = engagementsOf(p);
                        const r = rateOf(p);
                        const account = accounts.find((a) => a.platform === p.platform);
                        return (
                          <tr key={p.platform} className="border-t border-border/50">
                            <td className="py-3">
                              <span className="flex items-center gap-2">
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted"><Icon className="h-4 w-4 text-muted-foreground" /></span>
                                <span>
                                  <span className="block font-medium">{def.label}</span>
                                  {account?.username && <span className="block text-xs text-muted-foreground">@{account.username}</span>}
                                </span>
                              </span>
                            </td>
                            <td className="py-3 text-right tabular-nums">{p.posts}</td>
                            <td className="py-3 text-right tabular-nums">{fmt(p.views)}</td>
                            <td className="py-3 pl-6">
                              <span className="flex items-center gap-2">
                                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                                  <span className="block h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${(e / maxPlatformEngagement) * 100}%` }} />
                                </span>
                                <span className="w-14 text-right font-semibold tabular-nums">{fmt(e)}</span>
                              </span>
                            </td>
                            <td className="py-3 text-right tabular-nums text-muted-foreground">{r === null ? "—" : `${(r * 100).toFixed(1)}%`}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="min-w-0 border-border/60 lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top posts</CardTitle>
                <CardDescription>Your best performers in the last {range} days.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {!report?.topPosts.length ? (
                  <p className="px-6 pb-6 text-sm text-muted-foreground">Once posts get likes, comments or shares, the best ones appear here. Mako also learns from them when writing new posts.</p>
                ) : (
                  <ol className="divide-y divide-border/60">
                    {report.topPosts.map((post, i) => {
                      return (
                        <li key={post.id}>
                          <Link to={`/content/${post.contentId}`} className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-muted/40">
                            <span className="w-5 text-sm font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                            <span className="flex w-14 shrink-0 gap-1">
                              {post.platforms.map((p) => {
                                const def = platformOf(p);
                                const Icon = def.icon;
                                return <Icon key={p} className="h-4 w-4 text-muted-foreground" aria-label={def.label} />;
                              })}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{post.title}</span>
                              {post.publishedAt && (
                                <span className="block text-xs text-muted-foreground">{new Date(post.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                              )}
                            </span>
                            <span className="hidden gap-4 text-xs tabular-nums text-muted-foreground sm:flex">
                              <span title="Views"><Eye className="mr-1 inline h-3 w-3" />{fmt(post.views)}</span>
                              <span title="Likes">{fmt(post.likes)} likes</span>
                              <span title="Comments">{fmt(post.comments)} comments</span>
                            </span>
                            <span className="w-16 text-right text-sm font-semibold tabular-nums">{fmt(post.likes + post.comments + post.shares)}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Content pipeline</CardTitle>
                  <CardDescription>Every post in this workspace, right now.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {(["needs_approval", "scheduled", "overdue", "failed", "published", "draft"] as PostDisplayStatus[]).map((key) => {
                      const meta = POST_STATUS_META[key];
                      const count = pipeline[key] ?? 0;
                      return (
                        <li key={key}>
                          <Link to="/scheduler" className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                            <span className="flex items-center gap-2 text-muted-foreground">
                              <span className={cn("h-2 w-2 rounded-full", meta.dot)} aria-hidden />
                              {meta.label}
                            </span>
                            <span className={cn("font-semibold tabular-nums", count === 0 && "text-muted-foreground")}>{count}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-base">Leads</CardTitle>
                    <CardDescription>{leads.total} in total</CardDescription>
                  </div>
                  <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: "Hot", value: leads.hot },
                    { label: "Warm", value: leads.warm },
                    { label: "Cold", value: leads.cold },
                  ].map((l) => (
                    <Link key={l.label} to="/leads" className="rounded-lg bg-muted/50 py-3 hover:bg-muted">
                      <p className="font-display text-xl font-bold tabular-nums">{l.value}</p>
                      <p className="text-xs text-muted-foreground">{l.label}</p>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="border-border/60">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> What to do next</CardTitle>
                <CardDescription>Mako reads your results and brand voice and suggests changes.</CardDescription>
              </div>
              <Button variant="outline" onClick={runAiReport} disabled={aiLoading} className="gap-1.5">
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {aiReport ? "Refresh analysis" : "Analyse my results"}
              </Button>
            </CardHeader>
            {(aiReport || aiFailed) && (
              <CardContent className="space-y-5">
                {aiFailed && !aiReport ? (
                  <p className="text-sm text-muted-foreground">Mako needs a completed Brand voice and some published posts before it can analyse results.</p>
                ) : aiReport && (
                  <>
                    {aiReport.summary && <p className="text-sm leading-relaxed">{aiReport.summary}</p>}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <h3 className="flex items-center gap-1.5 text-sm font-semibold"><ArrowUp className="h-4 w-4 text-green-700 dark:text-green-400" /> Working well</h3>
                        <ul className="space-y-1.5 text-sm text-muted-foreground">
                          {aiReport.topPerformingTraits?.map((t, i) => <li key={i}>• {t}</li>)}
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <h3 className="flex items-center gap-1.5 text-sm font-semibold"><ArrowDown className="h-4 w-4 text-red-700 dark:text-red-400" /> Holding you back</h3>
                        <ul className="space-y-1.5 text-sm text-muted-foreground">
                          {aiReport.underperformingTraits?.map((t, i) => <li key={i}>• {t}</li>)}
                        </ul>
                      </div>
                    </div>
                    {aiReport.contentRecommendations?.length ? (
                      <ol className="space-y-2 rounded-lg bg-muted/40 p-4 text-sm">
                        {aiReport.contentRecommendations.map((r, i) => (
                          <li key={i} className="flex gap-2"><span className="font-semibold text-primary">{i + 1}.</span>{r}</li>
                        ))}
                      </ol>
                    ) : null}
                    {aiReport.optimalPostingTimes?.length ? (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Best times to post:</span>
                        {aiReport.optimalPostingTimes.map((t, i) => <Badge key={i} variant="secondary">{t}</Badge>)}
                      </div>
                    ) : null}
                  </>
                )}
              </CardContent>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default Analytics;
