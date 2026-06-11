import { useState } from 'react';
import { ExternalLink, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CommentInboxNode, PostInboxGroup } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PlatformPreview } from '@/components/content/PlatformPreview';
import { CommentThread } from './CommentThread';
import { postToPlatformPayload } from './postInboxUtils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

type Props = {
  post: PostInboxGroup;
  canReply: boolean;
  sendingId: string | null;
  manualText: Record<string, string>;
  onDraftChange: (id: string, text: string) => void;
  onSend: (node: CommentInboxNode) => void;
  onAiDraft: (node: CommentInboxNode) => void;
  onDismiss: (node: CommentInboxNode) => void;
  /** Hide link when already on content detail page */
  hideViewLink?: boolean;
  /** @deprecated Platform preview always shows full media layout */
  fullMedia?: boolean;
};

export function PostCommentCard({
  post,
  canReply,
  sendingId,
  manualText,
  onDraftChange,
  onSend,
  onAiDraft,
  onDismiss,
  hideViewLink = false,
}: Props) {
  const [replyingToId, setReplyingToId] = useState<string | null>(null);

  return (
    <Card className="overflow-hidden border-border/80 bg-card shadow-sm">
      <div className="p-4 space-y-3">
        <PlatformPreview
          mode="published"
          platform={post.platform}
          payload={postToPlatformPayload(post)}
          authorName={post.brandPageName ?? 'Your Page'}
          publishedAt={post.publishedAt}
          engagement={{
            likes: post.likeCount,
            comments: post.commentCount || post.totalComments,
            shares: post.shareCount,
            views: post.viewCount,
          }}
        />

        <div className="flex items-center gap-2 flex-wrap">
          {post.pendingCount > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {post.pendingCount} pending repl{post.pendingCount === 1 ? 'y' : 'ies'}
            </Badge>
          )}
          {!hideViewLink && (
            <Link
              to={`/content/${post.contentId}`}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline ml-auto"
            >
              View post <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>

      <CardContent className="p-0 border-t bg-muted/10">
        {post.comments.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6 px-4 space-y-2">
            {post.commentSyncSupported === false && post.commentSyncNote ? (
              <>
                <p className="text-amber-700 dark:text-amber-400 font-medium">
                  Comments cannot be synced for {post.platform}
                </p>
                <p className="text-xs leading-relaxed">{post.commentSyncNote}</p>
              </>
            ) : (
              <p>No comments on this post yet. Pull comments to sync.</p>
            )}
          </div>
        ) : (
          <Accordion type="single" collapsible defaultValue="comments" className="w-full">
            <AccordionItem value="comments" className="border-0">
              <AccordionTrigger className="px-4 py-3 hover:no-underline text-sm font-medium bg-background/80">
                <span className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  Comments ({post.totalComments || post.comments.length})
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-2 space-y-4 bg-background/50">
                {post.comments.map((comment) => (
                  <CommentThread
                    key={comment.id}
                    node={comment}
                    brandPageName={post.brandPageName}
                    canReply={canReply}
                    sendingId={sendingId}
                    replyingToId={replyingToId}
                    getDraft={(id) => manualText[id] ?? ''}
                    onDraftChange={onDraftChange}
                    onStartReply={setReplyingToId}
                    onSend={(node) => {
                      onSend(node);
                      setReplyingToId(null);
                    }}
                    onAiDraft={onAiDraft}
                    onDismiss={onDismiss}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
