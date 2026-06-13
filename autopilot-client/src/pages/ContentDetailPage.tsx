import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  MessageSquareReply,
  Pencil,
  RotateCcw,
  Send,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useTenant } from '@/hooks/useTenant';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/lib/permissions';
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
import { platformOf, type PlatformPayload, platformRequiresMedia, instagramHasMedia } from '@/lib/platforms';
import { formatScheduledAt } from '@/lib/schedule';
import { PostCommentCard } from '@/components/replies/PostCommentCard';
import { PostMediaGallery } from '@/components/replies/PostMediaGallery';
import { mergePublicationWithInbox, plainText } from '@/components/replies/postInboxUtils';

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

function DraftPlatformSection({
  platform,
  draft,
  scheduledAt,
  linkedMediaCount,
}: {
  platform: string;
  draft?: PlatformPayload;
  scheduledAt?: string | null;
  linkedMediaCount?: number;
}) {
  const plat = platformOf(platform);
  const Icon = plat.icon;
  const needsMedia = platformRequiresMedia(platform);
  const hasMedia = instagramHasMedia(draft, linkedMediaCount ?? 0);
  const instagramBlocked = needsMedia && !hasMedia;

  if (!draft) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
        No draft prepared for {plat.label}.
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border bg-card p-4 space-y-3 ${instagramBlocked ? 'border-amber-500/50 ring-1 ring-amber-500/20' : ''}`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${plat.color}18` }}
        >
          <Icon size={16} style={{ color: plat.color }} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{plat.label}</p>
          <p className="text-xs text-muted-foreground">Draft — not published yet</p>
        </div>
        {scheduledAt && (
          <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
            <Clock className="h-3 w-3" />
            {scheduledAt}
          </Badge>
        )}
        <Badge variant="secondary" className="capitalize text-[10px]">
          draft
        </Badge>
      </div>
      {instagramBlocked && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            Instagram requires at least one image or video. This platform will be skipped when
            scheduled or manual publish runs until you add attachments.
          </span>
        </div>
      )}
      {draft.title && <p className="text-sm font-medium">{draft.title}</p>}
      <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
        {plainText(draft.content ?? '')}
      </p>
      <PostMediaGallery items={draft.media ?? []} variant="full" />
    </div>
  );
}

function FailedPublicationBanner({
  platform,
  publications,
  onRetry,
  retrying,
}: {
  platform: string;
  publications: Publication[];
  onRetry: (platform: string) => void;
  retrying: boolean;
}) {
  const latest = publications[0];
  if (!latest || latest.status !== 'failed') return null;
  const plat = platformOf(platform);

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-medium text-destructive">{plat.label} publish failed</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs text-amber-700 border-amber-500/40"
          onClick={() => onRetry(platform)}
          disabled={retrying}
        >
          {retrying ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <RotateCcw className="h-3 w-3 mr-1" />
          )}
          Retry
        </Button>
      </div>
      {latest.errorMessage && (
        <p className="text-xs text-destructive whitespace-pre-wrap">{latest.errorMessage}</p>
      )}
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

  const draftPlatforms = useMemo(() => {
    return platforms.filter((p) => {
      const latest = pubsByPlatform[p]?.[0];
      return !latest || latest.status !== 'published';
    });
  }, [platforms, pubsByPlatform]);

  const contentItem = useMemo(
    () => (data ? toContentItem(data.item) : null),
    [data],
  );

  const scheduledAtLabel = useMemo(() => {
    if (!data?.item) return null;
    return formatScheduledAt(data.item.scheduledDate, data.item.scheduledTime);
  }, [data]);

  const instagramIssues = useMemo(() => {
    if (!data) return [];
    return platforms.filter((p) => {
      if (!platformRequiresMedia(p)) return false;
      const draft = data.item.platformPayloads?.[p];
      return !instagramHasMedia(draft, data.media.length);
    });
  }, [data, platforms]);

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
        await contentPublicationsApi.syncEngagement(tenant.id);
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
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading content…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center space-y-4">
        <p className="text-muted-foreground">{error ?? 'Content not found'}</p>
        <Button asChild variant="outline">
          <Link to="/content">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to content
          </Link>
        </Button>
      </div>
    );
  }

  const { item, media } = data;
  const canReply = can(P.replies.create);
  const pendingTotal = publishedPostGroups.reduce((s, p) => s + p.pendingCount, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 text-muted-foreground">
            <Link to="/content">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Content
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{item.title || 'Untitled content'}</h1>
          <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
            {item.status && (
              <Badge variant="secondary" className="capitalize">
                {item.status}
              </Badge>
            )}
            {scheduledAtLabel && (
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                Scheduled {scheduledAtLabel}
              </Badge>
            )}
            {item.created_at && <span>Created {new Date(item.created_at).toLocaleString()}</span>}
            {item.publishedAt && (
              <span>· Last published {new Date(item.publishedAt).toLocaleString()}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {failedPlatforms.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-amber-700 border-amber-500/40"
              onClick={handleRetryAllFailed}
              disabled={retryingAll || !!retryingPlatform}
            >
              {retryingAll ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-1" />
              )}
              Retry failed ({failedPlatforms.length})
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button type="button" size="sm" onClick={() => setPublishOpen(true)}>
            <Send className="h-4 w-4 mr-1" />
            Publish
          </Button>
        </div>
      </div>

      {item.publishFailedReason && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <p className="font-medium">Last publish had errors</p>
          <p className="text-xs mt-1 whitespace-pre-wrap">{item.publishFailedReason}</p>
        </div>
      )}

      {instagramIssues.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          <p className="font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Instagram blocked — missing attachments
          </p>
          <p className="text-xs mt-1 text-amber-800/90 dark:text-amber-200/90">
            {instagramIssues.map((p) => platformOf(p).label).join(', ')} will not publish until you
            add at least one image or video in Edit or Publish.
          </p>
        </div>
      )}

      {scheduledAtLabel && platforms.length > 0 && (
        <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Scheduled posting
          </p>
          <ul className="space-y-1.5">
            {platforms.map((platform) => {
              const plat = platformOf(platform);
              const Icon = plat.icon;
              const blocked =
                platformRequiresMedia(platform) &&
                !instagramHasMedia(item.platformPayloads?.[platform], media.length);
              return (
                <li key={platform} className="flex items-center gap-2 text-sm flex-wrap">
                  <Icon size={14} style={{ color: plat.color }} />
                  <span className="font-medium">{plat.label}</span>
                  <span className="text-muted-foreground">· {scheduledAtLabel}</span>
                  {blocked && (
                    <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-500/40">
                      No media — skipped
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="rounded-xl border bg-card p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Master draft</p>
        {item.campaignTheme && (
          <p className="text-sm text-muted-foreground">{plainText(item.campaignTheme)}</p>
        )}
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{plainText(item.content ?? '')}</p>
        {media.length > 0 && (
          <PostMediaGallery
            items={media.map((m) => ({
              url: m.mediaUrl,
              type: m.mediaType,
              name: m.name,
            }))}
            variant="full"
          />
        )}
      </div>

      {publishedPostGroups.length > 0 && (
        <>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <MessageSquareReply className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-lg font-semibold">Published posts & comments</h2>
                  <p className="text-xs text-muted-foreground">
                    Live posts with engagement and threaded replies
                    {pendingTotal > 0 ? ` · ${pendingTotal} awaiting reply` : ''}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchComments()}
                disabled={fetchingComments || !tenant}
              >
                {fetchingComments ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Pull comments
              </Button>
            </div>

            {loadingComments ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading comments…
              </div>
            ) : (
              <div className="space-y-4">
                {publishedPostGroups.map((post) => (
                  <PostCommentCard
                    key={post.key}
                    post={post}
                    canReply={canReply}
                    sendingId={sending}
                    manualText={manualText}
                    onDraftChange={(cid, text) => setManualText((p) => ({ ...p, [cid]: text }))}
                    onSend={(node) => void sendReply(node)}
                    onAiDraft={(node) => void generateAiReply(node)}
                    onDismiss={(node) => void dismissComment(node)}
                    hideViewLink
                    fullMedia
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {(failedPlatforms.length > 0 || draftPlatforms.length > 0) && (
        <>
          <Separator />
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Drafts & failed publishes</h2>
            <div className="grid gap-4">
              {failedPlatforms.map((platform) => (
                <FailedPublicationBanner
                  key={`fail-${platform}`}
                  platform={platform}
                  publications={pubsByPlatform[platform] ?? []}
                  onRetry={handleRetryPlatform}
                  retrying={retryingPlatform === platform}
                />
              ))}
              {draftPlatforms.map((platform) => {
                const latest = pubsByPlatform[platform]?.[0];
                if (latest?.status === 'failed') return null;
                return (
                  <DraftPlatformSection
                    key={`draft-${platform}`}
                    platform={platform}
                    draft={item.platformPayloads?.[platform]}
                    scheduledAt={scheduledAtLabel}
                    linkedMediaCount={media.length}
                  />
                );
              })}
            </div>
          </div>
        </>
      )}

      {platforms.length === 0 && (
        <p className="text-sm text-muted-foreground rounded-xl border border-dashed p-6 text-center">
          No platforms selected yet. Edit this content to choose platforms and publish.
        </p>
      )}

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
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
        <SheetContent
          side="right"
          className="w-full sm:max-w-3xl lg:max-w-4xl xl:max-w-5xl p-0 flex flex-col overflow-hidden"
        >
          {contentItem && (
            <PublishPanel
              item={contentItem}
              onCancel={() => setPublishOpen(false)}
              onPublished={handlePublished}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
