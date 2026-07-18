import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageCircle } from 'lucide-react';
import type { CommentInboxNode, PostInboxGroup } from '@/lib/api';
import { platformOf } from '@/lib/platforms';
import { Badge } from '@/components/ui/badge';
import { InboxSplitLayout } from '@/components/layout/InboxSplitLayout';
import { useIsMobile } from '@/hooks/use-mobile';
import { PostCommentCard } from './PostCommentCard';
import { plainText } from './postInboxUtils';
import { cn } from '@/lib/utils';

type Props = {
  posts: PostInboxGroup[];
  canReply: boolean;
  sendingId: string | null;
  manualText: Record<string, string>;
  onDraftChange: (id: string, text: string) => void;
  onSend: (node: CommentInboxNode) => void;
  onAiDraft: (node: CommentInboxNode) => void;
  onDismiss: (node: CommentInboxNode) => void;
};

export function PostCommentInbox({
  posts,
  canReply,
  sendingId,
  manualText,
  onDraftChange,
  onSend,
  onAiDraft,
  onDismiss,
}: Props) {
  const isMobile = useIsMobile();
  const [sort, setSort] = useState<'relevant' | 'recent'>('relevant');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const sortedPosts = useMemo(() => {
    return [...posts].sort((a, b) => {
      if (sort === 'relevant') {
        return b.engagementScore - a.engagementScore || b.pendingCount - a.pendingCount;
      }
      const aT = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bT = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bT - aT;
    });
  }, [posts, sort]);

  useEffect(() => {
    setSelectedKey((prev) => {
      if (prev && sortedPosts.some((p) => p.key === prev)) return prev;
      if (isMobile) return null;
      return sortedPosts[0]?.key ?? null;
    });
  }, [sortedPosts, isMobile]);

  const selected = sortedPosts.find((p) => p.key === selectedKey) ?? null;

  if (posts.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground text-sm space-y-2">
        <MessageCircle className="h-8 w-8 mx-auto opacity-40" />
        <p>No published posts yet. Publish to Facebook, Instagram, or LinkedIn, then pull comments.</p>
      </div>
    );
  }

  const listPane = (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 border-b flex items-center justify-between gap-2 bg-muted/20">
        <span className="text-xs text-muted-foreground">
          {posts.length} post{posts.length === 1 ? '' : 's'}
        </span>
        <select
          className="bg-background border rounded-md px-2 py-1 text-[11px]"
          value={sort}
          onChange={(e) => setSort(e.target.value as 'relevant' | 'recent')}
        >
          <option value="relevant">Most relevant</option>
          <option value="recent">Most recent</option>
        </select>
      </div>
      <div className="overflow-y-auto flex-1 min-h-0">
        {sortedPosts.map((post) => {
          const plat = platformOf(post.platform);
          const Icon = plat.icon;
          const title = post.postTitle?.trim() || plainText(post.postContent).slice(0, 48) || 'Untitled';
          return (
            <button
              key={post.key}
              type="button"
              onClick={() => setSelectedKey(post.key)}
              className={cn(
                'w-full text-left px-3 py-3 border-b hover:bg-muted/40 transition-colors',
                selectedKey === post.key && 'bg-primary/5 border-l-2 border-l-primary',
              )}
            >
              <div className="flex items-start gap-2 min-w-0">
                <Icon className="h-4 w-4 shrink-0 mt-0.5" style={{ color: plat.color }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {plat.label}
                    {post.publishedAt &&
                      ` · ${formatDistanceToNow(new Date(post.publishedAt), { addSuffix: true })}`}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {(post.totalComments || post.comments.length) > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {post.totalComments || post.comments.length} comments
                      </span>
                    )}
                    {post.pendingCount > 0 && (
                      <Badge variant="secondary" className="text-[9px] h-4">
                        {post.pendingCount} pending
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const detailPane = selected ? (
    <PostCommentCard
      post={selected}
      canReply={canReply}
      sendingId={sendingId}
      manualText={manualText}
      onDraftChange={onDraftChange}
      onSend={onSend}
      onAiDraft={onAiDraft}
      onDismiss={onDismiss}
    />
  ) : (
    <div className="h-full rounded-lg border border-dashed flex items-center justify-center text-sm text-muted-foreground p-6 text-center min-h-[280px]">
      Select a post to view its comment thread.
    </div>
  );

  return (
    <InboxSplitLayout
      list={listPane}
      detail={detailPane}
      hasSelection={Boolean(selected)}
      onBack={() => setSelectedKey(null)}
      backLabel="Posts"
      listMinHeight="min-h-[420px] md:min-h-[560px]"
      detailMinHeight="min-h-[420px] md:min-h-[560px]"
    />
  );
}
