import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import type { CommentInboxNode, PostInboxGroup } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { PostContextHeader } from './PostContextHeader';
import { CommentThread } from './CommentThread';
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
  hideViewLink?: boolean;
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
    <div className="flex flex-col min-h-0 min-w-0 space-y-0">
      <PostContextHeader post={post} hideViewLink={hideViewLink} />

      <Card className="overflow-hidden border-border/80 shadow-sm min-w-0 mt-4">
        <CardContent className="p-0 bg-muted/10">
          {post.comments.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8 px-4 space-y-2">
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
                    Comment thread ({post.totalComments || post.comments.length})
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
    </div>
  );
}
