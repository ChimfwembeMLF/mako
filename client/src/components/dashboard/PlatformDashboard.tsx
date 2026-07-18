import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  BarChart3,
  CalendarClock,
  Eye,
  Heart,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquareReply,
  RefreshCw,
  Share2,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTenant } from '@/hooks/useTenant';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  analyticsApi,
  contentPublicationsApi,
  mailApi,
  socialAccountsApi,
  type PlatformDashboardResponse,
  type SocialAccount,
} from '@/lib/api';
import { platformOf } from '@/lib/platforms';

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function StatPill({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="font-medium text-foreground">{value}</span>
      <span>{label}</span>
    </div>
  );
}

function normalizePlatformId(platform: string): string {
  const key = platform.toLowerCase();
  if (key === 'x') return 'twitter';
  return key;
}

function mergeWithSocialAccounts(
  dashboard: PlatformDashboardResponse | null,
  accounts: SocialAccount[],
): PlatformDashboardResponse {
  const accountsByPlatform = new Map<string, SocialAccount[]>();
  for (const account of accounts.filter((a) => a.connected)) {
    const key = normalizePlatformId(account.platform);
    const list = accountsByPlatform.get(key) ?? [];
    list.push(account);
    accountsByPlatform.set(key, list);
  }

  const basePlatforms = dashboard?.platforms ?? [];
  const platformIds = new Set(basePlatforms.map((p) => p.platform));

  const mergedPlatforms = basePlatforms.map((row) => {
    const linked = accountsByPlatform.get(row.platform) ?? [];
    if (linked.length === 0) return row;
    const primary = linked[0];
    return {
      ...row,
      connected: true,
      accountCount: Math.max(row.accountCount, linked.length),
      accountName: row.accountName ?? primary.accountName,
      username: row.username ?? primary.username,
    };
  });

  for (const [platform, linked] of accountsByPlatform) {
    if (platformIds.has(platform)) continue;
    const primary = linked[0];
    const def = platformOf(platform);
    mergedPlatforms.push({
      platform,
      label: def.label,
      connected: true,
      accountCount: linked.length,
      accountName: primary.accountName,
      username: primary.username,
      publishedPosts: 0,
      scheduledPosts: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      views: 0,
      engagementScore: 0,
      followers: 0,
      reach: 0,
      impressions: 0,
      pendingReplies: 0,
    });
  }

  const totals = mergedPlatforms.reduce(
    (acc, p) => ({
      connectedPlatforms: acc.connectedPlatforms + (p.connected ? 1 : 0),
      publishedPosts: acc.publishedPosts + p.publishedPosts,
      scheduledPosts: acc.scheduledPosts + p.scheduledPosts,
      likes: acc.likes + p.likes,
      comments: acc.comments + p.comments,
      shares: acc.shares + p.shares,
      views: acc.views + p.views,
      engagementScore: acc.engagementScore + p.engagementScore,
      pendingReplies: acc.pendingReplies + p.pendingReplies,
      followers: acc.followers + p.followers,
      reach: acc.reach + p.reach,
      impressions: acc.impressions + p.impressions,
    }),
    dashboard?.totals ?? {
      connectedPlatforms: 0,
      publishedPosts: 0,
      scheduledPosts: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      views: 0,
      engagementScore: 0,
      pendingReplies: 0,
      followers: 0,
      reach: 0,
      impressions: 0,
    },
  );

  return { platforms: mergedPlatforms, totals };
}

export function PlatformDashboard() {
  const { tenant } = useTenant();
  const { activeWorkspace, workspaceVersion, loading: workspaceLoading } = useWorkspace();
  const [data, setData] = useState<PlatformDashboardResponse | null>(null);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenant?.id || !activeWorkspace) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [dashboardResult, gmailResult, accountsResult] = await Promise.allSettled([
        analyticsApi.getPlatformDashboard(tenant.id, activeWorkspace),
        mailApi.gmailStatus(),
        socialAccountsApi.findByTenant(tenant.id, activeWorkspace),
      ]);

      const dashboard =
        dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
      const accounts =
        accountsResult.status === 'fulfilled' && Array.isArray(accountsResult.value)
          ? accountsResult.value
          : [];

      if (!dashboard && accounts.length === 0) {
        const reason =
          dashboardResult.status === 'rejected'
            ? dashboardResult.reason instanceof Error
              ? dashboardResult.reason.message
              : 'Failed to load platform dashboard'
            : 'Failed to load platform dashboard';
        setError(reason);
        setData(null);
      } else {
        setData(mergeWithSocialAccounts(dashboard, accounts));
      }

      if (gmailResult.status === 'fulfilled') {
        setGmailConnected(Boolean(gmailResult.value.connected));
        setGmailEmail(gmailResult.value.email ?? null);
      } else {
        setGmailConnected(false);
        setGmailEmail(null);
      }
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Failed to load platform dashboard');
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, activeWorkspace]);

  useEffect(() => {
    void load();
  }, [load, workspaceVersion]);

  const syncEngagement = async () => {
    if (!tenant?.id || !activeWorkspace) return;
    setSyncing(true);
    try {
      await contentPublicationsApi.syncEngagement(tenant.id, activeWorkspace);
      await load();
    } finally {
      setSyncing(false);
    }
  };

  if (workspaceLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading workspace…
        </CardContent>
      </Card>
    );
  }

  if (!activeWorkspace) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Select a workspace to see your connected platforms.
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading platform overview…
        </CardContent>
      </Card>
    );
  }

  const totals = data?.totals;
  const platforms = [...(data?.platforms ?? [])].sort((a, b) => {
    if (a.connected === b.connected) return a.label.localeCompare(b.label);
    return a.connected ? -1 : 1;
  });
  const connectedCount = totals?.connectedPlatforms ?? 0;

  return (
    <div className="space-y-4">
      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold font-display">Connected platforms</h2>
          <p className="text-sm text-muted-foreground">
            Unified view across every channel you publish to.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void syncEngagement()} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
            Sync engagement
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/publisher">
              <Link2 className="h-4 w-4 mr-1.5" />
              Manage connections
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/analytics">
              <BarChart3 className="h-4 w-4 mr-1.5" />
              Full analytics
            </Link>
          </Button>
        </div>
      </div>

      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Connected', value: connectedCount, sub: `of ${platforms.length}` },
            { label: 'Published', value: fmt(totals.publishedPosts), sub: 'posts' },
            { label: 'Scheduled', value: fmt(totals.scheduledPosts), sub: 'queued' },
            { label: 'Engagement', value: fmt(totals.likes + totals.comments + totals.shares), sub: 'interactions' },
            { label: 'Reach', value: fmt(totals.reach), sub: 'today' },
            { label: 'Pending replies', value: totals.pendingReplies, sub: 'comments' },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold mt-0.5">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {platforms.map((row) => {
          const def = platformOf(row.platform);
          const Icon = def.icon;
          return (
            <Card
              key={row.platform}
              className="transition-shadow hover:shadow-card"
            >
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${def.color}18` }}
                    >
                      <Icon className="h-4 w-4" style={{ color: def.color }} />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-semibold">{def.label}</CardTitle>
                      {row.connected ? (
                        <p className="text-xs text-muted-foreground truncate">
                          {row.accountName}
                          {row.accountCount > 1 ? ` +${row.accountCount - 1}` : ''}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Not connected</p>
                      )}
                    </div>
                  </div>
                  <Badge variant={row.connected ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                    {row.connected ? 'Live' : 'Offline'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {row.connected ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <StatPill icon={BarChart3} label="posts" value={row.publishedPosts} />
                      <StatPill icon={CalendarClock} label="scheduled" value={row.scheduledPosts} />
                      <StatPill icon={Heart} label="likes" value={fmt(row.likes)} />
                      <StatPill icon={MessageCircle} label="comments" value={fmt(row.comments)} />
                      <StatPill icon={Share2} label="shares" value={fmt(row.shares)} />
                      <StatPill icon={Eye} label="views" value={fmt(row.views)} />
                      {row.followers > 0 && (
                        <StatPill icon={Users} label="followers" value={fmt(row.followers)} />
                      )}
                      {row.pendingReplies > 0 && (
                        <StatPill icon={MessageSquareReply} label="pending" value={row.pendingReplies} />
                      )}
                    </div>
                    {row.lastPublishedAt && (
                      <p className="text-[10px] text-muted-foreground">
                        Last published{' '}
                        {formatDistanceToNow(new Date(row.lastPublishedAt), { addSuffix: true })}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {row.pendingReplies > 0 && (
                        <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                          <Link to="/replies">Reply ({row.pendingReplies})</Link>
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                        <Link to="/scheduler">Scheduler</Link>
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link to="/publisher">Connect {def.label}</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}

        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-[#ea4335]/10 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-[#ea4335]" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">Gmail</CardTitle>
                  <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                    {gmailConnected ? gmailEmail ?? 'Connected' : 'Not connected'}
                  </p>
                </div>
              </div>
              <Badge variant={gmailConnected ? 'default' : 'secondary'} className="text-[10px]">
                {gmailConnected ? 'Live' : 'Offline'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {gmailConnected ? (
              <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                <Link to="/mail">Open Mail</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link to="/mail">Connect Gmail</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {connectedCount === 0 && !gmailConnected && (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="py-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Connect your social accounts in Connections to see posts, engagement, and replies in one place.
            </p>
            <Button asChild>
              <Link to="/publisher">Connect platforms</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
