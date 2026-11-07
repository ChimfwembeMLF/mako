import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useTenant } from '@/hooks/useTenant';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/lib/permissions';
import { usePageBreadcrumb } from '@/hooks/usePageBreadcrumb';
import { ContentEditor } from '@/components/content/ContentEditor';
import { PublishPanel } from '@/components/content/PublishPanel';
import { ContentItem } from '@/components/content/types';
import {
  commentRepliesApi,
  contentItemsApi,
  contentPublicationsApi,
  resolveQueued,
  type CommentInboxNode,
  type PostInboxGroup,
} from '@/lib/api';
import { platformOf, buildPlatformPayloads, type PlatformPayload, platformRequiresMedia, instagramHasMedia } from '@/lib/platforms';
import { formatScheduledAt } from '@/lib/schedule';
import { PostCommentCard } from '@/components/replies/PostCommentCard';
import { PostMediaGallery } from '@/components/replies/PostMediaGallery';
import { mergePublicationWithInbox, plainText } from '@/components/replies/postInboxUtils';
import { RichTextContent } from '@/components/RichTextContent';
import { normalizeRichContent } from '@/lib/rich-text';
import { StatusPill } from '@/components/StatusPill';
import { statusOf, TONE_DOT } from '@/lib/postStatus';
import { cn } from '@/lib/utils';
import { resolveMediaUrl } from '@/lib/mediaUrl';

type Publication = {
  id: string;
  platform: string;
  status: string;
  publishedContent: string;
  publishedTitle?: string;
  publishedMedia?: Array<{ url: string; type?: string; name?: string }>;
  externalPostId?: string;
  errorMessage?: string;
  publishedAt?: string;
  created_at?: string;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  viewCount?: number;
  engagementScore?: number;
};

type MediaAsset = {
  id: string;
  mediaUrl: string;
  mediaType?: string;
  name?: string;
};

type ContentDetails = {
  item: {
    id: string;
    title?: string;
    content?: string;
    status?: string;
    platforms?: string[];
    platformPayloads?: Record<string, PlatformPayload>;
    campaignTheme?: string;
    campaignId?: string;
    workspaceId?: string;
    publishFailedReason?: string;
    scheduledDate?: string;
    scheduledTime?: string;
    created_at?: string;
    publishedAt?: string;
  };
  publications: Publication[];
  media: MediaAsset[];
};

function toContentItem(item: ContentDetails['item']): ContentItem {
  return {
    id: item.id,
    title: item.title,
    content: item.content,
    platforms: item.platforms,
    platformPayloads: item.platformPayloads,
    campaign_theme: item.campaignTheme,
    status: item.status,
    created_at: item.created_at,
  };
}

/** Where one channel stands, in the words shown on the page. */
type ChannelState =
  | { kind: 'published'; pub: Publication }
  | { kind: 'failed'; pub: Publication }
  | { kind: 'blocked' }
  | { kind: 'scheduled'; when: string }
  | { kind: 'draft' };

const CHANNEL_STATE_LABEL: Record<ChannelState['kind'], { label: string; status: string }> = {
  published: { label: 'Published', status: 'published' },
  failed: { label: 'Didn’t publish', status: 'publish_failed' },
  blocked: { label: 'Needs an image', status: 'review' },
  scheduled: { label: 'Scheduled', status: 'scheduled' },
  draft: { label: 'Not published', status: 'draft' },
};

function PlatformTitle({ platform, size = 16 }: { platform: string; size?: number }) {
  const plat = platformOf(platform);
  const Icon = plat.icon;
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${plat.color}18` }}>
        <Icon size={size - 2} style={{ color: plat.color }} />
      </span>
      <span className="truncate">{plat.label}</span>
    </span>
  );
}

function DraftPreview({ draft }: { draft?: PlatformPayload }) {
  if (!draft) {
    return <p className="text-sm text-muted-foreground">Nothing has been written for this channel yet.</p>;
  }
  return (
    <div className="space-y-4">
      {draft.title && <p className="text-base font-semibold">{draft.title}</p>}
      <RichTextContent html={normalizeRichContent(draft.content ?? '')} />
      <PostMediaGallery items={draft.media ?? []} variant="full" />
    </div>
  );
}

export default function ContentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeWorkspace } = useWorkspace();
  const { tenant } = useTenant();
  const { can } = usePermissions();
  const { toast } = useToast();

  const [data, setData] = useState<ContentDetails | null>(null);
  const [inboxPosts, setInboxPosts] = useState<PostInboxGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingComments, setLoadingComments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [retryingPlatform, setRetryingPlatform] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);
  const [fetchingComments, setFetchingComments] = useState(false);
  const [manualText, setManualText] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  usePageBreadcrumb(data?.item?.title || undefined);

  const loadComments = useCallback(async (contentId: string, tenantId: string) => {
    setLoadingComments(true);
    try {
      const { posts } = await commentRepliesApi.inbox(tenantId, contentId);
      setInboxPosts(posts);
    } catch {
      setInboxPosts([]);
    } finally {
      setLoadingComments(false);
    }
  }, []);

  const loadDetails = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await contentItemsApi.getDetails(id);
      setData(res as ContentDetails);
      setError(null);
      if (tenant?.id) {
        void loadComments(id, tenant.id);
      }
    } catch {
      setError('Content not found');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id, tenant?.id, loadComments]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  useEffect(() => {
    const edit = searchParams.get('edit');
    const publish = searchParams.get('publish');
    if (edit === '1' || edit === 'true') {
      setEditOpen(true);
      searchParams.delete('edit');
      setSearchParams(searchParams, { replace: true });
    }
    if (publish === '1' || publish === 'true') {
      setPublishOpen(true);
      searchParams.delete('publish');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const platforms = useMemo(() => {
    if (!data) return [];
    const fromItem = data.item.platforms ?? [];
    const fromPubs = data.publications.map((p) => p.platform);
    const fromDrafts = Object.keys(data.item.platformPayloads ?? {});
    return [...new Set([...fromItem, ...fromPubs, ...fromDrafts])];
  }, [data]);

  const pubsByPlatform = useMemo(() => {
    const map: Record<string, Publication[]> = {};
    for (const pub of data?.publications ?? []) {
      if (!map[pub.platform]) map[pub.platform] = [];
      map[pub.platform].push(pub);
    }
    return map;
  }, [data]);

  const publishedPostGroups = useMemo(() => {
    if (!data) return [];
    const title = data.item.title || 'Published post';
    const groups: PostInboxGroup[] = [];

    for (const platform of platforms) {
      const pubs = pubsByPlatform[platform] ?? [];
      const latestPublished = pubs.find((p) => p.status === 'published');
      if (!latestPublished) continue;
      groups.push(
        mergePublicationWithInbox(latestPublished, data.item.id, title, inboxPosts),
      );
    }
    return groups;
  }, [data, platforms, pubsByPlatform, inboxPosts]);

  const failedPlatforms = useMemo(() => {
    return platforms.filter((p) => pubsByPlatform[p]?.[0]?.status === 'failed');
  }, [platforms, pubsByPlatform]);

  const contentItem = useMemo(
    () => (data ? toContentItem(data.item) : null),
    [data],
  );

  const scheduledAtLabel = useMemo(() => {
    if (!data?.item) return null;
    return formatScheduledAt(data.item.scheduledDate, data.item.scheduledTime);
  }, [data]);

  const editorWorkspaceId = data?.item.workspaceId ?? activeWorkspace ?? null;

  const retryPlatforms = async (targetPlatforms: string[], all = false) => {
    if (!data?.item.id || targetPlatforms.length === 0) return;
    if (all) setRetryingAll(true);
    else setRetryingPlatform(targetPlatforms[0]);

    try {
      const { submitPublish } = await import('@/lib/publishContent');
      await submitPublish(
        data.item.id,
        targetPlatforms,
        data.item.platformPayloads as Record<string, unknown> | undefined,
        (t) => toast(t),
        { waitInForeground: true },
      );
      await loadDetails();
    } catch (err: unknown) {
      toast({
        title: 'Retry failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setRetryingPlatform(null);
      setRetryingAll(false);
    }
  };

  const fetchComments = async () => {
    if (!tenant?.id || !data?.item.id) return;
    setFetchingComments(true);
    try {
      const raw = await commentRepliesApi.fetch(tenant.id);
      const result = (await resolveQueued(raw)) as { fetched?: number; autoReplied?: number };
      try {
        await contentPublicationsApi.syncEngagement(tenant.id, activeWorkspace ?? undefined);
      } catch {
        /* best-effort */
      }
      const parts = [
        (result?.fetched ?? 0) > 0
          ? `${result.fetched} new comment${result.fetched !== 1 ? 's' : ''}`
          : 'Comments up to date',
        (result?.autoReplied ?? 0) > 0 ? `${result.autoReplied} auto-replied` : null,
      ].filter(Boolean);
      toast({ title: 'Comments synced', description: parts.join(' · ') });
      await loadComments(data.item.id, tenant.id);
    } catch (err: unknown) {
      toast({
        title: 'Sync failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setFetchingComments(false);
    }
  };

  const sendReply = async (node: CommentInboxNode) => {
    const text = manualText[node.id];
    if (!text?.trim()) return;
    setSending(node.id);
    try {
      await commentRepliesApi.send(node.id, text);
      toast({ title: 'Reply sent to platform' });
      setManualText((prev) => {
        const next = { ...prev };
        delete next[node.id];
        return next;
      });
      if (tenant?.id && data?.item.id) {
        await loadComments(data.item.id, tenant.id);
      }
    } catch (err: unknown) {
      toast({
        title: 'Send failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setSending(null);
    }
  };

  const generateAiReply = async (node: CommentInboxNode) => {
    setSending(node.id);
    try {
      const raw = await commentRepliesApi.suggest(node.id);
      const result = (await resolveQueued(raw)) as { content?: string };
      const text = result?.content ?? '';
      if (!text.trim()) {
        toast({ title: 'No suggestion', variant: 'destructive' });
      } else {
        setManualText((prev) => ({ ...prev, [node.id]: text }));
      }
    } catch (err: unknown) {
      toast({
        title: 'AI draft failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setSending(null);
    }
  };

  const dismissComment = async (node: CommentInboxNode) => {
    await commentRepliesApi.update(node.id, { status: 'dismissed' } as never);
    if (tenant?.id && data?.item.id) {
      await loadComments(data.item.id, tenant.id);
    }
  };

  const handleRetryPlatform = (platform: string) => {
    void retryPlatforms([platform]);
  };

  const handleRetryAllFailed = () => {
    void retryPlatforms(failedPlatforms, true);
  };

  const handleEditSaved = () => {
    setEditOpen(false);
    void loadDetails();
  };

  const handlePublished = () => {
    setPublishOpen(false);
    void loadDetails();
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading post…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="font-medium">This post doesn’t exist any more</p>
        <Button asChild variant="outline">
          <Link to="/content"><ArrowLeft className="mr-1.5 h-4 w-4" /> All posts</Link>
        </Button>
      </div>
    );
  }

  const { item, media } = data;
  const canReply = can(P.replies.create);
  const itemStatus = (item.status ?? 'draft').toLowerCase();
  const isQueued = ['scheduled', 'approved'].includes(itemStatus);

  const stateOf = (platform: string): ChannelState => {
    const latest = pubsByPlatform[platform]?.[0];
    if (latest?.status === 'published') return { kind: 'published', pub: latest };
    if (latest?.status === 'failed') return { kind: 'failed', pub: latest };
    if (platformRequiresMedia(platform) && !instagramHasMedia(item.platformPayloads?.[platform], media.length)) return { kind: 'blocked' };
    if (scheduledAtLabel && isQueued) return { kind: 'scheduled', when: scheduledAtLabel };
    return { kind: 'draft' };
  };
  const active = platforms.includes(selectedPlatform ?? '') ? (selectedPlatform as string) : platforms[0];
  const activeState = active ? stateOf(active) : null;
  const activeGroup = active ? publishedPostGroups.find((g) => g.platform === active) : undefined;
  const activeDraft = active
    ? item.platformPayloads?.[active] ?? buildPlatformPayloads(item.content ?? '', item.title ?? '', [active])[active]
    : undefined;
  const pendingTotal = publishedPostGroups.reduce((s, p) => s + p.pendingCount, 0);
  const anyPublished = publishedPostGroups.length > 0;

  return (
    <div className="w-full min-w-0 space-y-6 pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Link to="/content" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Posts
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="break-words font-display text-2xl font-semibold sm:text-3xl">{item.title || 'Untitled post'}</h1>
            <StatusPill status={item.status} />
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {isQueued && scheduledAtLabel && (
              <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> Goes out {scheduledAtLabel}</span>
            )}
            {item.publishedAt && <span>Published {formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })}</span>}
            {item.campaignId && (
              <Link to={`/campaigns/${item.campaignId}`} className="font-medium text-primary hover:underline">Part of a campaign</Link>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {failedPlatforms.length > 0 && (
            <Button variant="outline" onClick={handleRetryAllFailed} disabled={retryingAll || !!retryingPlatform} className="gap-1.5">
              {retryingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Retry {failedPlatforms.length === 1 ? platformOf(failedPlatforms[0]).label : `${failedPlatforms.length} channels`}
            </Button>
          )}
          <Button variant="outline" onClick={() => setEditOpen(true)} className="gap-1.5">
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Button onClick={() => setPublishOpen(true)} className="gap-1.5">
            <Send className="h-4 w-4" /> {anyPublished ? 'Publish again' : 'Publish'}
          </Button>
        </div>
      </div>

      {platforms.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-6 py-14 text-center">
          <p className="font-medium">No channels chosen yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Edit the post to pick where it should go.</p>
          <Button variant="outline" className="mt-4" onClick={() => setEditOpen(true)}>Choose channels</Button>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0 space-y-4">
            <div className="flex gap-1 overflow-x-auto border-b" role="tablist" aria-label="Channels">
              {platforms.map((p) => {
                const st = stateOf(p);
                const tone = statusOf(CHANNEL_STATE_LABEL[st.kind].status).tone;
                const plat = platformOf(p);
                const Icon = plat.icon;
                return (
                  <button
                    key={p}
                    type="button"
                    role="tab"
                    aria-selected={p === active}
                    onClick={() => setSelectedPlatform(p)}
                    className={cn(
                      '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                      p === active ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon size={14} style={{ color: plat.color }} />
                    {plat.label}
                    <span className={cn('h-1.5 w-1.5 rounded-full', TONE_DOT[tone])} aria-label={CHANNEL_STATE_LABEL[st.kind].label} />
                  </button>
                );
              })}
            </div>

            {active && activeState && (
              <div className="space-y-4" role="tabpanel">
                {activeState.kind === 'failed' && (
                  <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-destructive">{platformOf(active).label} didn’t publish</p>
                      {activeState.pub.errorMessage && (
                        <p className="mt-1 whitespace-pre-wrap text-xs text-destructive/90">{activeState.pub.errorMessage}</p>
                      )}
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => handleRetryPlatform(active)} disabled={retryingPlatform === active || retryingAll}>
                      {retryingPlatform === active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                      Retry
                    </Button>
                  </div>
                )}
                {activeState.kind === 'blocked' && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-300/70 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {platformOf(active).label} only accepts posts with an image or video, so it will be skipped.{' '}
                      <button type="button" className="font-medium underline underline-offset-2" onClick={() => setEditOpen(true)}>Add one</button>
                    </span>
                  </div>
                )}

                {activeState.kind === 'published' && activeGroup ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-muted-foreground">
                        {activeGroup.pendingCount > 0 ? (
                          <span className="font-medium text-foreground">{activeGroup.pendingCount} comment{activeGroup.pendingCount === 1 ? '' : 's'} waiting for a reply</span>
                        ) : (
                          'Live post and comments'
                        )}
                      </p>
                      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => void fetchComments()} disabled={fetchingComments || !tenant}>
                        <RefreshCw className={cn('h-3.5 w-3.5', fetchingComments && 'animate-spin')} />
                        {fetchingComments ? 'Checking…' : 'Check for comments'}
                      </Button>
                    </div>
                    {loadingComments ? (
                      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading comments…
                      </div>
                    ) : (
                      <PostCommentCard
                        post={activeGroup}
                        canReply={canReply}
                        sendingId={sending}
                        manualText={manualText}
                        onDraftChange={(cid, text) => setManualText((p) => ({ ...p, [cid]: text }))}
                        onSend={(node) => void sendReply(node)}
                        onAiDraft={(node) => void generateAiReply(node)}
                        onDismiss={(node) => void dismissComment(node)}
                        hideViewLink
                      />
                    )}
                  </>
                ) : (
                  <article className="rounded-2xl border bg-card">
                    <header className="flex items-center justify-between gap-3 border-b px-5 py-3 text-sm">
                      <span className="font-medium"><PlatformTitle platform={active} /></span>
                      <span className="text-xs text-muted-foreground">
                        {activeState.kind === 'scheduled' ? `Goes out ${activeState.when}` : activeState.kind === 'failed' ? 'What was sent' : 'Preview of what will be sent'}
                      </span>
                    </header>
                    <div className="px-5 py-5">
                      <DraftPreview draft={activeDraft} />
                    </div>
                  </article>
                )}
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="text-sm font-semibold">Channels</h2>
              <ul className="mt-3 space-y-1">
                {platforms.map((p) => {
                  const st = stateOf(p);
                  const meta = CHANNEL_STATE_LABEL[st.kind];
                  const group = publishedPostGroups.find((g) => g.platform === p);
                  return (
                    <li key={p}>
                      <button
                        type="button"
                        onClick={() => setSelectedPlatform(p)}
                        className={cn('flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted', p === active && 'bg-muted')}
                      >
                        <PlatformTitle platform={p} size={14} />
                        <span className="flex shrink-0 flex-col items-end">
                          <StatusPill status={meta.status} label={meta.label} className="px-2 text-[11px]" />
                          {group && (group.likeCount || group.commentCount || group.viewCount) ? (
                            <span className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                              {group.likeCount} likes · {group.commentCount} comments
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {pendingTotal > 0 && (
                <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">{pendingTotal} comment{pendingTotal === 1 ? '' : 's'} waiting for a reply</p>
              )}
            </section>

            <section className="rounded-2xl border bg-card p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Original draft</h2>
                <button type="button" onClick={() => setEditOpen(true)} className="text-xs font-medium text-primary hover:underline">Edit</button>
              </div>
              {item.campaignTheme && <p className="mt-2 text-xs text-muted-foreground">Theme: {plainText(item.campaignTheme)}</p>}
              <div className="mt-2 line-clamp-[8] text-sm text-foreground/80 [&_p]:my-0">
                <RichTextContent html={normalizeRichContent(item.content ?? '')} />
              </div>
              {media.length > 0 && (
                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  {media.slice(0, 8).map((m) => (
                    <div key={m.id} className="aspect-square overflow-hidden rounded-md bg-muted">
                      {/video/.test(m.mediaType ?? '') ? (
                        <video src={resolveMediaUrl(m.mediaUrl)} className="h-full w-full object-cover" muted />
                      ) : (
                        <img src={resolveMediaUrl(m.mediaUrl)} alt={m.name ?? ''} className="h-full w-full object-cover" loading="lazy" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border bg-card p-5">
              <h2 className="text-sm font-semibold">Details</h2>
              <dl className="mt-3 grid grid-cols-[96px_minmax(0,1fr)] gap-y-2 text-xs">
                <dt className="text-muted-foreground">Status</dt>
                <dd>{statusOf(item.status).label}</dd>
                {scheduledAtLabel && (<><dt className="text-muted-foreground">{isQueued ? 'Goes out' : 'Was set for'}</dt><dd>{scheduledAtLabel}</dd></>)}
                {item.publishedAt && (<><dt className="text-muted-foreground">Last published</dt><dd>{new Date(item.publishedAt).toLocaleString()}</dd></>)}
                {item.created_at && (<><dt className="text-muted-foreground">Created</dt><dd>{new Date(item.created_at).toLocaleString()}</dd></>)}
                {item.campaignId && (<><dt className="text-muted-foreground">Campaign</dt><dd><Link to={`/campaigns/${item.campaignId}`} className="text-primary hover:underline">Open campaign</Link></dd></>)}
              </dl>
            </section>
          </aside>
        </div>
      )}

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-xl">
          {contentItem && (
            <div className="p-1">
              <ContentEditor
                item={contentItem}
                workspaceId={editorWorkspaceId}
                onReset={() => setEditOpen(false)}
                onSaved={handleEditSaved}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={publishOpen} onOpenChange={setPublishOpen}>
        <SheetContent side="right" className="flex w-full flex-col overflow-hidden p-0 sm:max-w-3xl lg:max-w-4xl xl:max-w-5xl">
          {contentItem && (
            <PublishPanel item={contentItem} onCancel={() => setPublishOpen(false)} onPublished={handlePublished} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
