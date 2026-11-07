import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, formatDistanceToNowStrict, isToday, isTomorrow } from "date-fns";
import { HelpCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useWorkspace } from "@/hooks/useWorkspace";
import { P, type PermissionKey } from "@/lib/permissions";
import { canAccessSocialShell } from "@/lib/social-shell";
import { getScheduleSortKey } from "@/lib/schedule";
import { getPostDisplayStatus } from "@/lib/post-status";
import {
  analyticsApi,
  approvalRequestsApi,
  brandProfilesApi,
  contentItemsApi,
  leadsApi,
  type PerformanceReport,
  type PlatformDashboardResponse,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { TourService } from "@/services/tour.service";
import { dashboardTourConfig } from "./Dashboard.tour";

// ── Data ────────────────────────────────────────────────────────────────────

type Post = {
  id: string;
  title?: string;
  content?: string;
  status: string;
  platforms?: string[];
  scheduled_date: string | null;
  scheduled_time: string | null;
  publish_failed_reason?: string | null;
};

type Lead = { id: string; name?: string; source?: string; classification?: string; status?: string; created_at?: string };

type DashboardData = {
  brandReady: boolean | null;
  platform: PlatformDashboardResponse | null;
  performance: PerformanceReport | null;
  posts: Post[];
  leads: Lead[];
  approvals: number | null;
};

const EMPTY: DashboardData = { brandReady: null, platform: null, performance: null, posts: [], leads: [], approvals: null };

/** Each source loads on its own, so one failing (or not permitted) doesn't blank the page. */
function useDashboardData() {
  const { tenant } = useTenant();
  const { activeWorkspace, workspaceVersion, loading: wsLoading } = useWorkspace();
  const { can, loading: permsLoading } = usePermissions();
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!tenant?.id) return;
    const ws = activeWorkspace ?? undefined;
    const quiet = <T,>(p: Promise<T>) => p.catch(() => null);
    const [brand, platform, performance, posts, leads, approvals] = await Promise.all([
      quiet(brandProfilesApi.getMine(tenant.id, ws)),
      can(P.analytics.view) ? quiet(analyticsApi.getPlatformDashboard(tenant.id, ws)) : null,
      can(P.analytics.view) ? quiet(analyticsApi.getPerformance(tenant.id, 7, ws)) : null,
      can(P.content.view) ? quiet(contentItemsApi.findAll(tenant.id, { workspaceId: ws })) : null,
      can(P.leads.view) ? quiet(leadsApi.findAll(tenant.id, ws)) : null,
      can(P.approvals.view) ? quiet(approvalRequestsApi.findAll({ tenantId: tenant.id, status: "pending" })) : null,
    ]);
    const list = <T,>(x: unknown): T[] => (Array.isArray(x) ? x : Array.isArray((x as { items?: T[] })?.items) ? (x as { items: T[] }).items : []);
    setData({
      brandReady: brand ? Boolean(brand.companyName || brand.description) : false,
      platform,
      performance,
      posts: list<Post>(posts),
      leads: list<Lead>(leads),
      approvals: Array.isArray(approvals) ? approvals.length : null,
    });
    setLoading(false);
    // workspaceVersion changes when the workspace's data changes, so the page reloads with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id, activeWorkspace, workspaceVersion, can]);

  useEffect(() => {
    if (tenant?.id && !wsLoading && !permsLoading) void load();
  }, [load, tenant?.id, wsLoading, permsLoading]);

  return { data, loading, tenantName: tenant?.name };
}

const WEEK_MS = 7 * 86_400_000;

function summarise(d: DashboardData, now = Date.now()) {
  const withStatus = d.posts.map((p) => ({ ...p, display: getPostDisplayStatus(p, now) }));
  const upcoming = withStatus
    .filter((p) => p.display === "scheduled" && p.scheduled_date)
    .map((p) => ({ ...p, at: getScheduleSortKey(p.scheduled_date as string, p.scheduled_time) }))
    .sort((a, b) => a.at - b.at);
  const recentLeads = [...d.leads].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
  return {
    upcoming,
    scheduledThisWeek: upcoming.filter((p) => p.at - now < WEEK_MS).length,
    drafts: withStatus.filter((p) => p.display === "draft").length,
    failed: withStatus.filter((p) => p.display === "failed" || p.display === "overdue").length,
    needsApproval: withStatus.filter((p) => p.display === "needs_approval").length,
    newLeads: recentLeads.filter((l) => now - new Date(l.created_at ?? 0).getTime() < WEEK_MS).length,
    hotLeads: d.leads.filter((l) => l.classification === "hot" && (l.status ?? "new") === "new").length,
    recentLeads,
  };
}

// ── Small pieces ────────────────────────────────────────────────────────────

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function change(current: number, previous: number): { text: string; tone: "up" | "down" | "flat" } | null {
  if (!previous && !current) return null;
  if (!previous) return { text: "New this week", tone: "up" };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { text: "Same as last week", tone: "flat" };
  return { text: `${pct > 0 ? "+" : ""}${pct}% vs last week`, tone: pct > 0 ? "up" : "down" };
}

/** A tiny trend line; colour comes from the parent's text colour. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2 || values.every((v) => v === 0)) return null;
  const max = Math.max(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - (v / max) * 24}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Stat({ label, value, note, href, trend, loading }: {
  label: string; value: string; note?: { text: string; tone: "up" | "down" | "flat" } | string | null; href: string; trend?: number[]; loading: boolean;
}) {
  const n = typeof note === "string" ? { text: note, tone: "flat" as const } : note;
  return (
    <Link to={href} className="group flex min-w-0 flex-col justify-between rounded-2xl border border-border/60 bg-card p-5 transition-colors hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-3 h-9 w-24" />
      ) : (
        <p className="mt-2 font-display text-4xl font-bold tabular-nums tracking-tight">{value}</p>
      )}
      <div className="mt-2 flex min-h-[2rem] items-end justify-between gap-3">
        <p className={cn(
          "text-xs",
          n?.tone === "up" ? "text-positive-deep" : n?.tone === "down" ? "text-destructive" : "text-muted-foreground",
        )}>
          {loading ? "" : n?.text ?? ""}
        </p>
        {!loading && trend && <div className="w-20 shrink-0 text-primary/70"><Sparkline values={trend} /></div>}
      </div>
    </Link>
  );
}

function SectionTitle({ title, href, action }: { title: string; href?: string; action?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {href && (
        <Link to={href} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          {action ?? "View all"}
        </Link>
      )}
    </div>
  );
}

function whenLabel(at: number) {
  const d = new Date(at);
  if (isToday(d)) return `Today, ${format(d, "HH:mm")}`;
  if (isTomorrow(d)) return `Tomorrow, ${format(d, "HH:mm")}`;
  return format(d, "EEE d MMM, HH:mm");
}

// ── Quick links: grouped by job, each with a live count instead of an icon ──

type QuickLink = { title: string; desc: string; href: string; meta?: string | null; perms?: PermissionKey[] };
type QuickGroup = { key: string; title: string; links: QuickLink[] };

function QuickLinks({ groups }: { groups: QuickGroup[] }) {
  const { canAny, loading } = usePermissions();
  const visible = groups
    .map((g) => ({ ...g, links: g.links.filter((l) => loading || !l.perms || canAny(...l.perms)) }))
    .filter((g) => g.links.length);
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {visible.map((g, gi) => (
        <section key={g.key} className="rounded-2xl border border-border/60 bg-card p-2">
          <header className="flex items-baseline gap-2 px-3 pb-2 pt-3">
            <span className="font-display text-xs font-bold tabular-nums text-primary">{String(gi + 1).padStart(2, "0")}</span>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</h3>
          </header>
          <ul>
            {g.links.map((l) => (
              <li key={l.href}>
                <Link
                  to={l.href}
                  className="group block rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
                      <span className="truncate">{l.title}</span>
                      <span aria-hidden className="-translate-x-1 text-primary opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100">→</span>
                    </span>
                    {l.meta && (
                      <span className="shrink-0 text-[11px] font-semibold tabular-nums text-primary">{l.meta}</span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{l.desc}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

const Dashboard = () => {
  const { user } = useAuth();
  const { can, canAny, loading: permsLoading } = usePermissions();
  const { data, loading, tenantName } = useDashboardData();
  const s = useMemo(() => summarise(data), [data]);
  const busy = loading || permsLoading;
  const showSocial = permsLoading || canAccessSocialShell(canAny);

  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      TourService.autoStartTour("dashboard", dashboardTourConfig.steps, undefined, dashboardTourConfig.driverConfig);
    }, 500);
    return () => clearTimeout(timer);
  }, [user]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const perf = data.performance;
  const engagements = (t?: { likes: number; comments: number; shares: number }) => (t ? t.likes + t.comments + t.shares : 0);
  const connected = data.platform?.totals.connectedPlatforms ?? null;
  const pendingReplies = data.platform?.totals.pendingReplies ?? null;

  const setup = [
    { done: data.brandReady === true, title: "Describe your brand", desc: "So every post and reply sounds like you", href: "/brand-brain" },
    { done: (connected ?? 0) > 0, title: "Connect a social account", desc: "Facebook, Instagram, LinkedIn or X", href: "/publisher" },
    { done: s.upcoming.length > 0 || (data.platform?.totals.publishedPosts ?? 0) > 0, title: "Schedule your first post", desc: "Plan it on the calendar", href: "/scheduler" },
  ];
  const setupLeft = setup.filter((x) => !x.done);
  const showSetup = !busy && setupLeft.length > 0;

  const attention = [
    { count: data.approvals ?? s.needsApproval, label: "posts waiting for approval", href: "/approvals", show: canAny(P.approvals.view, P.content.approve) },
    { count: pendingReplies ?? 0, label: "comments and messages to answer", href: "/replies", show: can(P.replies.view) },
    { count: s.failed, label: "posts that failed or missed their time", href: "/scheduler", show: can(P.content.view), urgent: true },
    { count: s.hotLeads, label: "hot leads not contacted yet", href: "/leads", show: can(P.leads.view) },
  ].filter((a) => a.show && a.count > 0);

  const groups: QuickGroup[] = [
    {
      key: "create", title: "Create", links: [
        { title: "Brand voice", desc: "Who you are and how you sound", href: "/brand-brain", meta: data.brandReady === false ? "Set up" : null },
        { title: "Posts", desc: "Write and generate content", href: "/content", meta: s.drafts ? `${s.drafts} drafts` : null, perms: [P.content.view] },
        { title: "Campaigns", desc: "Group posts around a goal", href: "/campaigns", perms: [P.content.view] },
        { title: "Media", desc: "Images and videos", href: "/media", perms: [P.media.view] },
      ],
    },
    {
      key: "publish", title: "Publish", links: [
        { title: "Schedule", desc: "Your content calendar", href: "/scheduler", meta: s.scheduledThisWeek ? `${s.scheduledThisWeek} this week` : null, perms: [P.content.view] },
        { title: "Approvals", desc: "Review before it goes live", href: "/approvals", meta: data.approvals ? `${data.approvals} waiting` : null, perms: [P.approvals.view, P.content.approve] },
        { title: "Social accounts", desc: "Connected pages and profiles", href: "/publisher", meta: connected != null ? `${connected} linked` : null },
        { title: "Ads", desc: "Paid campaigns", href: "/ads" },
      ],
    },
    {
      key: "engage", title: "Engage", links: [
        { title: "Inbox", desc: "Comments and DMs in one place", href: "/replies", meta: pendingReplies ? `${pendingReplies} to answer` : null, perms: [P.replies.view] },
        { title: "Leads", desc: "People interested in buying", href: "/leads", meta: s.newLeads ? `${s.newLeads} new` : null, perms: [P.leads.view] },
        { title: "WhatsApp", desc: "Number, bots and templates", href: "/whatsapp" },
        { title: "Email", desc: "Gmail inbox and drafts", href: "/mail", perms: [P.leads.email, P.leads.view] },
      ],
    },
    {
      key: "grow", title: "Grow", links: [
        { title: "Analytics", desc: "What's working, by channel", href: "/analytics", meta: perf ? `${compact.format(perf.current.views)} views` : null, perms: [P.analytics.view] },
        { title: "Chatbot", desc: "Website assistant", href: "/chatbot", perms: [P.chatbot.view] },
        { title: "Knowledge", desc: "Documents the AI answers from", href: "/chatbot/knowledge", perms: [P.chatbot.view] },
        { title: "Chat history", desc: "Conversations with your bot", href: "/chatbot/sessions", perms: [P.chatbot.view] },
      ],
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-8 pb-10">
      {/* Greeting */}
      <header id="tour-dashboard-welcome" className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, d MMMM")}</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {greeting}{user?.firstName ? `, ${user.firstName}` : ""}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {tenantName ? <>Here&rsquo;s what&rsquo;s happening at <span className="font-medium text-foreground">{tenantName}</span>.</> : "Here’s what’s happening today."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {can(P.content.create) && (
            <Button asChild className="gap-1.5 rounded-xl">
              <Link to="/content"><Plus className="h-4 w-4" /> New post</Link>
            </Button>
          )}
          {showSocial && (
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/social">Social overview</Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:flex"
            aria-label="Take the tour"
            title="Take the tour"
            onClick={() => TourService.startTour("dashboard", dashboardTourConfig.steps, undefined, dashboardTourConfig.driverConfig)}
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Setup, until it's done */}
      {showSetup && (
        <section className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">Finish setting up</h2>
            <p className="text-sm text-muted-foreground">{setup.length - setupLeft.length} of {setup.length} done</p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/15">
            <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${((setup.length - setupLeft.length) / setup.length) * 100}%` }} />
          </div>
          <ol className="mt-4 grid gap-3 md:grid-cols-3">
            {setup.map((step, i) => (
              <li key={step.href}>
                <Link
                  to={step.href}
                  className={cn(
                    "flex h-full gap-3 rounded-xl border bg-card p-4 transition-colors",
                    step.done ? "border-border/50 opacity-60" : "border-border/70 hover:border-primary/50",
                  )}
                >
                  <span className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                    step.done ? "bg-positive-deep text-white" : "bg-primary/10 text-primary",
                  )}>
                    {step.done ? "✓" : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block text-sm font-semibold", step.done && "line-through")}>{step.title}</span>
                    <span className="block text-xs text-muted-foreground">{step.desc}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Numbers */}
      <section id="tour-dashboard-stats" aria-label="This week" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat
          label="Views · 7 days"
          value={perf ? compact.format(perf.current.views) : "—"}
          note={perf ? change(perf.current.views, perf.previous.views) : "Connect accounts to see views"}
          trend={perf?.daily.map((d) => d.views)}
          href="/analytics"
          loading={busy}
        />
        <Stat
          label="Engagement · 7 days"
          value={perf ? compact.format(engagements(perf.current)) : "—"}
          note={perf ? change(engagements(perf.current), engagements(perf.previous)) : null}
          trend={perf?.daily.map((d) => d.engagements)}
          href="/analytics"
          loading={busy}
        />
        <Stat
          label="New leads · 7 days"
          value={can(P.leads.view) ? String(s.newLeads) : "—"}
          note={s.hotLeads ? `${s.hotLeads} hot` : `${data.leads.length} in total`}
          href="/leads"
          loading={busy}
        />
        <Stat
          label="Scheduled"
          value={String(s.upcoming.length)}
          note={s.scheduledThisWeek ? `${s.scheduledThisWeek} going out this week` : "Nothing this week"}
          href="/scheduler"
          loading={busy}
        />
      </section>

      {/* Coming up + needs you */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SectionTitle title="Coming up" href="/scheduler" action="Open calendar" />
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            {busy ? (
              <div className="space-y-px">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[72px] rounded-none" />)}</div>
            ) : s.upcoming.length === 0 ? (
              <div className="flex flex-col items-start gap-3 p-6">
                <p className="text-sm text-muted-foreground">Nothing scheduled yet. Posts you schedule will line up here.</p>
                <Button asChild size="sm" variant="outline" className="rounded-xl"><Link to="/scheduler">Plan a post</Link></Button>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {s.upcoming.slice(0, 5).map((p) => {
                  const d = new Date(p.at);
                  return (
                    <li key={p.id}>
                      <Link to="/scheduler" className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/40">
                        <span className="flex w-12 shrink-0 flex-col items-center rounded-xl border border-border/70 py-1.5 leading-none">
                          <span className="text-[10px] font-semibold uppercase text-primary">{format(d, "MMM")}</span>
                          <span className="mt-0.5 font-display text-lg font-bold tabular-nums">{format(d, "d")}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{p.title || p.content?.slice(0, 80) || "Untitled post"}</span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {whenLabel(p.at)}
                            {p.platforms?.length ? ` · ${p.platforms.map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join(", ")}` : ""}
                          </span>
                        </span>
                        <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                          in {formatDistanceToNowStrict(d)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {perf && perf.topPosts.length > 0 && (
            <div className="mt-6">
              <SectionTitle title="Top posts this week" href="/analytics" action="See analytics" />
              <ol className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                {perf.topPosts.slice(0, 4).map((p, i) => {
                  const eng = p.likes + p.comments + p.shares;
                  return (
                    <li key={p.id} className={cn("flex items-center gap-4 px-5 py-3.5", i > 0 && "border-t border-border/60")}>
                      <span className="w-5 shrink-0 font-display text-sm font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{p.title || "Untitled post"}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {p.platforms.map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join(", ")}
                          {p.publishedAt ? ` · ${format(new Date(p.publishedAt), "d MMM")}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-display text-sm font-bold tabular-nums">{compact.format(p.views)}</span>
                        <span className="block text-[11px] text-muted-foreground">views · {compact.format(eng)} eng.</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </section>

        {/* On phones, what needs doing comes first. */}
        <section className="order-first lg:order-none">
          <SectionTitle title="Needs you" />
          <div className="rounded-2xl border border-border/60 bg-card">
            {busy ? (
              <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : attention.length === 0 ? (
              <div className="p-6">
                <p className="font-display text-base font-semibold">You&rsquo;re all caught up</p>
                <p className="mt-1 text-sm text-muted-foreground">No approvals, replies or failed posts waiting.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {attention.map((a) => (
                  <li key={a.label}>
                    <Link to={a.href} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40">
                      <span className={cn("font-display text-2xl font-bold tabular-nums", a.urgent ? "text-destructive" : "text-foreground")}>{a.count}</span>
                      <span className="text-sm text-muted-foreground">{a.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {can(P.leads.view) && !busy && s.recentLeads.length > 0 && (
            <div className="mt-6">
              <SectionTitle title="Latest leads" href="/leads" />
              <ul className="rounded-2xl border border-border/60 bg-card">
                {s.recentLeads.slice(0, 4).map((l, i) => (
                  <li key={l.id} className={cn("flex items-center justify-between gap-3 px-5 py-3", i > 0 && "border-t border-border/60")}>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{l.name || "Unknown"}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {l.source ?? "Lead"}{l.created_at ? ` · ${formatDistanceToNowStrict(new Date(l.created_at))} ago` : ""}
                      </span>
                    </span>
                    {l.classification && l.classification !== "inbound" && (
                      <span className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize",
                        l.classification === "hot" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                      )}>
                        {l.classification}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* Quick links */}
      <section>
        <SectionTitle title="Quick links" />
        <QuickLinks groups={groups} />
      </section>
    </div>
  );
};

export default Dashboard;
