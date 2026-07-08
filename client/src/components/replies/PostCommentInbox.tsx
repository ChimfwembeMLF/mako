import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import type { CommentInboxNode, PostInboxGroup } from '@/lib/api';
import { PostCommentCard } from './PostCommentCard';

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
  const [sort, setSort] = useState<'relevant' | 'recent'>('relevant');

  if (posts.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground text-sm space-y-2">
        <MessageCircle className="h-8 w-8 mx-auto opacity-40" />
        <p>No published posts yet. Publish to Facebook, Instagram, or LinkedIn, then pull comments.</p>
      </div>
    );
  }

  const sortedPosts = [...posts].sort((a, b) => {
    if (sort === 'relevant') {
      return b.engagementScore - a.engagementScore || b.pendingCount - a.pendingCount;
    }
    const aT = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bT = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bT - aT;
  });

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
        <span>
          {posts.length} published post{posts.length === 1 ? '' : 's'}
        </span>
        <select
          className="bg-muted/50 border rounded-md px-2 py-1 text-xs"
          value={sort}
          onChange={(e) => setSort(e.target.value as 'relevant' | 'recent')}
        >
          <option value="relevant">Most relevant</option>
          <option value="recent">Most recent</option>
        </select>
      </div>

      {sortedPosts.map((post) => (
        <PostCommentCard
          key={post.key}
          post={post}
          canReply={canReply}
          sendingId={sendingId}
          manualText={manualText}
          onDraftChange={onDraftChange}
          onSend={onSend}
          onAiDraft={onAiDraft}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}
