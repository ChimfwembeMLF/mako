import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { differenceInCalendarDays, format } from 'date-fns';
import { ArrowLeft, CalendarDays, Loader2, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useTenant } from '@/hooks/useTenant';
import { usePageBreadcrumb } from '@/hooks/usePageBreadcrumb';
import { confirmModal } from '@/components/ConfirmModal';
import { contentCampaignsApi } from '@/lib/api';
import { platformOf } from '@/lib/platforms';
import { plainText } from '@/components/replies/postInboxUtils';
import { StatusPill } from '@/components/StatusPill';
import { cn } from '@/lib/utils';

type Campaign = {
  id: string;
  name: string;
  goal?: string | null;
  theme?: string | null;
  summary?: string | null;
  platforms?: string[] | null;
  postCount?: number;
  startDate?: string | null;
  status: string;
  created_at?: string;
};

type Post = {
  id: string;
  title?: string | null;
  content?: string | null;
  status?: string | null;
  platforms?: string[] | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
};

const dayKey = (d?: string | null) => (d ? String(d).slice(0, 10) : 'unscheduled');
const asDate = (key: string) => new Date(`${key}T00:00:00`);

function PlatformMarks({ platforms }: { platforms?: string[] | null }) {
  return (
    <span className="flex items-center gap-1">
      {(platforms ?? []).map((p) => {
        const plat = platformOf(p);
        const Icon = plat.icon;
        return (
          <span key={p} title={plat.label} className="flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: `${plat.color}14` }}>
            <Icon size={13} style={{ color: plat.color }} />
          </span>
        );
      })}
    </span>
  );
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const { can, isSuperAdmin } = usePermissions();
  const { toast } = useToast();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const canApprove = isSuperAdmin || can('content.approve');

  usePageBreadcrumb(campaign?.name);

  const load = useCallback(async () => {
    if (!id || !tenant?.id) return;
    setLoading(true);
    try {
      const res = await contentCampaignsApi.getOne(id, tenant.id);
      setCampaign(res.campaign as unknown as Campaign);
      setPosts((res.posts ?? []) as unknown as Post[]);
      setMissing(false);
    } catch {
      setMissing(true);
    } finally {
      setLoading(false);
    }
  }, [id, tenant?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const by = (s: string[]) => posts.filter((p) => s.includes(p.status ?? 'draft')).length;
    return {
      total: posts.length,
      published: by(['published']),
      upcoming: by(['scheduled', 'approved']),
      drafts: by(['draft', 'review', 'pending', 'pending_approval']),
      failed: by(['publish_failed', 'failed', 'partial']),
    };
  }, [posts]);

  const days = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const p of posts) {
      const k = dayKey(p.scheduledDate);
      map.set(k, [...(map.get(k) ?? []), p]);
    }
    return [...map.entries()].sort(([a], [b]) => (a === 'unscheduled' ? 1 : b === 'unscheduled' ? -1 : a.localeCompare(b)));
  }, [posts]);

  const datedKeys = days.map(([k]) => k).filter((k) => k !== 'unscheduled');
  const firstDay = datedKeys[0] ? asDate(datedKeys[0]) : campaign?.startDate ? asDate(dayKey(campaign.startDate)) : null;
  const lastDay = datedKeys.length ? asDate(datedKeys[datedKeys.length - 1]) : null;
  const channels = useMemo(
    () => [...new Set([...(campaign?.platforms ?? []), ...posts.flatMap((p) => p.platforms ?? [])])],
    [campaign, posts],
  );

  async function approve() {
    if (!campaign || !tenant) return;
    const ok = await confirmModal(
      `Mako will publish these ${stats.total} posts automatically on their dates. Any post you've edited stays as you left it.`,
      'Approve and schedule?',
      'Approve and schedule',
    );
    if (!ok) return;
    setApproving(true);
    try {
      const { approved, shiftedDays } = await contentCampaignsApi.approve(campaign.id, tenant.id);
      toast({
        title: `${approved} posts scheduled`,
        description: shiftedDays ? `The start date had passed, so the series moved forward ${shiftedDays} days.` : undefined,
      });
      await load();
    } catch (e) {
      toast({ title: "Couldn't approve this campaign", description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setApproving(false);
    }
  }

  async function remove() {
    if (!campaign || !tenant) return;
    const ok = await confirmModal(
      'Posts that already went out stay published. Scheduled posts go back to drafts, so nothing else from this campaign is sent.',
      `Delete “${campaign.name}”?`,
      'Delete campaign',
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await contentCampaignsApi.remove(campaign.id, tenant.id);
      toast({ title: 'Campaign deleted' });
      navigate('/campaigns');
    } catch (e) {
      toast({ title: 'Delete failed', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading campaign…
      </div>
    );
  }

  if (missing || !campaign) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="font-medium">This campaign doesn’t exist any more</p>
        <Button asChild variant="outline"><Link to="/campaigns"><ArrowLeft className="mr-1.5 h-4 w-4" /> All campaigns</Link></Button>
      </div>
    );
  }

  const needsReview = campaign.status === 'review';
  const progress = stats.total ? Math.round((stats.published / stats.total) * 100) : 0;

  return (
    <div className="w-full min-w-0 space-y-6 pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Link to="/campaigns" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Campaigns
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-semibold sm:text-3xl">{campaign.name}</h1>
            <StatusPill status={campaign.status} label={needsReview ? 'Needs review' : stats.total && stats.published === stats.total ? 'Finished' : 'Scheduled'} />
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{stats.total} posts</span>
            {firstDay && (
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {format(firstDay, 'd MMM')}
                {lastDay && lastDay.getTime() !== firstDay.getTime() ? ` – ${format(lastDay, 'd MMM yyyy')}` : ` ${format(firstDay, 'yyyy')}`}
              </span>
            )}
            {channels.length > 0 && <PlatformMarks platforms={channels} />}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => void remove()} disabled={deleting}>
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete
          </Button>
          {!needsReview && (
            <Button variant="outline" asChild><Link to="/scheduler">Open in Schedule</Link></Button>
          )}
          {needsReview && canApprove && (
            <Button onClick={() => void approve()} disabled={approving} className="gap-1.5">
              {approving && <Loader2 className="h-4 w-4 animate-spin" />} Approve and schedule
            </Button>
          )}
        </div>
      </div>

      {needsReview && (
        <div className="rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <span className="font-medium">Nothing goes out until this campaign is approved.</span>{' '}
          {canApprove ? 'Read through the posts below, edit any you want to change, then approve.' : 'Ask someone with approval access to approve it.'}
        </div>
      )}

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-4">
        {[
          ['Published', stats.published],
          ['Coming up', stats.upcoming],
          ['Drafts', stats.drafts],
          ['Didn’t publish', stats.failed],
        ].map(([label, n]) => (
          <div key={label as string} className="bg-card p-4 sm:p-5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn('mt-1 font-display text-2xl font-semibold tabular-nums', label === 'Didn’t publish' && Number(n) > 0 && 'text-destructive')}>{n}</p>
          </div>
        ))}
        <div className="col-span-2 bg-card px-4 pb-4 sm:col-span-4 sm:px-5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{progress}% published</span>
            <span>{stats.published} of {stats.total}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="overflow-hidden rounded-2xl border bg-card">
          <h2 className="border-b px-5 py-3 text-sm font-semibold">Posting plan</h2>
          {posts.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium">No posts in this campaign</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {campaign.postCount
                  ? `It was planned with ${campaign.postCount} posts, but they’ve since been deleted or moved.`
                  : 'Its posts may have been deleted.'}
              </p>
            </div>
          ) : (
            <ol>
              {days.map(([key, list]) => {
                const date = key === 'unscheduled' ? null : asDate(key);
                const dayNo = date && firstDay ? differenceInCalendarDays(date, firstDay) + 1 : null;
                return (
                  <li key={key} className="grid grid-cols-[64px_minmax(0,1fr)] border-b last:border-b-0 sm:grid-cols-[88px_minmax(0,1fr)]">
                    <div className="border-r bg-muted/30 px-3 py-4 text-center">
                      {date ? (
                        <>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{format(date, 'EEE')}</p>
                          <p className="font-display text-xl font-semibold leading-tight tabular-nums">{format(date, 'd')}</p>
                          <p className="text-[11px] text-muted-foreground">{format(date, 'MMM')}</p>
                          {dayNo && <p className="mt-1 text-[10px] text-muted-foreground/80">Day {dayNo}</p>}
                        </>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">No date</p>
                      )}
                    </div>
                    <ul className="divide-y divide-border/60">
                      {list.map((p) => {
                        const editable = ['draft', 'review'].includes(p.status ?? 'draft');
                        return (
                          <li key={p.id} className="group flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-start sm:gap-4 sm:px-5">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <PlatformMarks platforms={p.platforms} />
                                {p.scheduledTime && <span className="text-xs tabular-nums text-muted-foreground">{String(p.scheduledTime).slice(0, 5)}</span>}
                              </div>
                              <Link to={`/content/${p.id}`} className="mt-1.5 block text-sm font-medium hover:underline hover:underline-offset-4">
                                {p.title || 'Untitled post'}
                              </Link>
                              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{plainText(p.content ?? '')}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <StatusPill status={p.status} />
                              {editable && (
                                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                  <Link to={`/content/edit/${p.id}`} aria-label={`Edit ${p.title ?? 'post'}`}><Pencil className="h-3.5 w-3.5" /></Link>
                                </Button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <aside className="space-y-4">
          {(campaign.goal || campaign.theme) && (
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="text-sm font-semibold">Brief</h2>
              <dl className="mt-3 space-y-3 text-sm">
                {campaign.goal && (<div><dt className="text-xs text-muted-foreground">Goal</dt><dd className="mt-0.5">{campaign.goal}</dd></div>)}
                {campaign.theme && (<div><dt className="text-xs text-muted-foreground">Theme</dt><dd className="mt-0.5">{campaign.theme}</dd></div>)}
              </dl>
            </section>
          )}
          {campaign.summary && (
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="text-sm font-semibold">AI plan</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{plainText(campaign.summary)}</p>
            </section>
          )}
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="text-sm font-semibold">Channels</h2>
            <ul className="mt-3 space-y-2">
              {channels.map((c) => {
                const plat = platformOf(c);
                const Icon = plat.icon;
                const n = posts.filter((p) => p.platforms?.includes(c)).length;
                return (
                  <li key={c} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><Icon size={14} style={{ color: plat.color }} />{plat.label}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{n} post{n === 1 ? '' : 's'}</span>
                  </li>
                );
              })}
            </ul>
            {campaign.created_at && (
              <p className="mt-4 border-t pt-3 text-[11px] text-muted-foreground">Created {format(new Date(campaign.created_at), 'd MMM yyyy')}</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
