import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  Link2,
  Loader2,
  MessageSquareReply,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTenant } from '@/hooks/useTenant';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  analyticsApi,
  commentRepliesApi,
  socialAccountsApi,
  type PostInboxGroup,
  type SocialAccount,
} from '@/lib/api';
import { platformOf } from '@/lib/platforms';

type OverviewState = {
  connectedAccounts: SocialAccount[];
  scheduledPosts: number;
  pendingReplies: number;
  inboxHighlights: PostInboxGroup[];
};

export function SocialOverview() {
  const { tenant } = useTenant();
  const { activeWorkspace, workspaceVersion, loading: workspaceLoading } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<OverviewState>({
    connectedAccounts: [],
    scheduledPosts: 0,
    pendingReplies: 0,
    inboxHighlights: [],
  });

  const load = useCallback(async () => {
    if (!tenant?.id || !activeWorkspace) {
      setState({
        connectedAccounts: [],
        scheduledPosts: 0,
        pendingReplies: 0,
        inboxHighlights: [],
      });
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [accountsResult, dashboardResult, inboxResult] = await Promise.allSettled([
        socialAccountsApi.findByTenant(tenant.id, activeWorkspace),
        analyticsApi.getPlatformDashboard(tenant.id, activeWorkspace),
        commentRepliesApi.inbox(tenant.id, undefined, activeWorkspace),
      ]);

      const accounts =
        accountsResult.status === 'fulfilled' && Array.isArray(accountsResult.value)
          ? accountsResult.value.filter((a) => a.connected)
          : [];

      const dashboard =
        dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
      const inboxPosts =
        inboxResult.status === 'fulfilled' ? inboxResult.value.posts ?? [] : [];

      const pendingFromInbox = inboxPosts.reduce((sum, p) => sum + (p.pendingCount ?? 0), 0);
      const pendingReplies = Math.max(dashboard?.totals.pendingReplies ?? 0, pendingFromInbox);

      setState({
        connectedAccounts: accounts,
        scheduledPosts: dashboard?.totals.scheduledPosts ?? 0,
        pendingReplies,
        inboxHighlights: inboxPosts
          .filter((p) => (p.pendingCount ?? 0) > 0)
          .slice(0, 3),
      });

      if (!accounts.length && !dashboard && inboxResult.status === 'rejected') {
        setError('Could not load social overview');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load social overview');
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, activeWorkspace]);

  useEffect(() => {
    void load();
  }, [load, workspaceVersion]);

  if (workspaceLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading workspace…
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Select a workspace to see connections, queue, and inbox.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading overview…
      </div>
    );
  }

  const { connectedAccounts, scheduledPosts, pendingReplies, inboxHighlights } = state;
  const platformLabels = [
    ...new Set(connectedAccounts.map((a) => platformOf(a.platform).label)),
  ].slice(0, 4);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold font-display">Overview</h2>
        {error && (
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link to="/publisher">
          <Card className="h-full border-0 bg-card hover:bg-primary-pale/40 transition-colors">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Link2 className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">Connections</span>
              </div>
              <p className="text-2xl font-semibold tabular-nums">{connectedAccounts.length}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {connectedAccounts.length === 0
                  ? 'No platforms connected yet'
                  : platformLabels.join(' · ') +
                    (connectedAccounts.length > platformLabels.length ? '…' : '')}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/scheduler">
          <Card className="h-full border-0 bg-card hover:bg-primary-pale/40 transition-colors">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarClock className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">Upcoming</span>
              </div>
              <p className="text-2xl font-semibold tabular-nums">{scheduledPosts}</p>
              <p className="text-xs text-muted-foreground">
                {scheduledPosts === 1 ? 'Post in the queue' : 'Posts in the queue'}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/replies">
          <Card className="h-full border-0 bg-card hover:bg-primary-pale/40 transition-colors">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MessageSquareReply className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">Inbox</span>
              </div>
              <p className="text-2xl font-semibold tabular-nums">{pendingReplies}</p>
              <p className="text-xs text-muted-foreground">
                {pendingReplies === 1 ? 'Pending reply' : 'Pending replies'}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {inboxHighlights.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Inbox highlights</p>
          <ul className="space-y-2">
            {inboxHighlights.map((post) => (
              <li key={post.key}>
                <Link
                  to="/replies"
                  className="flex items-start justify-between gap-3 rounded-xl bg-card px-4 py-3 hover:bg-primary-pale/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {post.postTitle || post.postContent?.slice(0, 80) || 'Post'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {platformOf(post.platform).label}
                      {post.brandPageName ? ` · ${post.brandPageName}` : ''}
                      {' · '}
                      {post.pendingCount} pending
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
