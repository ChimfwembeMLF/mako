import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Bot, ChevronDown, Loader2, PenLine, Send } from 'lucide-react';
import type { CommentInboxNode } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageAttachments } from './MessageAttachments';
import { MessageReactions } from './MessageReactions';
import { cn } from '@/lib/utils';

type Props = {
  node: CommentInboxNode;
  depth?: number;
  brandPageName?: string | null;
  canReply: boolean;
  sendingId: string | null;
  replyingToId: string | null;
  getDraft: (id: string) => string;
  onDraftChange: (id: string, text: string) => void;
  onStartReply: (id: string) => void;
  onSend: (node: CommentInboxNode) => void;
  onAiDraft: (node: CommentInboxNode) => void;
  onDismiss: (node: CommentInboxNode) => void;
};

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function replyBody(node: CommentInboxNode): string {
  return (node.replyText ?? node.commentText ?? '').trim();
}

function hasSyncedBrandReply(node: CommentInboxNode): boolean {
  const parentReply = node.replyText?.trim();
  if (!parentReply) return false;
  return node.children.some(
    (child) => child.isFromBrand && replyBody(child) === parentReply,
  );
}

function visibleChildren(node: CommentInboxNode): CommentInboxNode[] {
  const parentReply = node.replyText?.trim();
  if (!parentReply) return node.children;
  return node.children.filter(
    (child) => !(child.isFromBrand && replyBody(child) === parentReply),
  );
}

function CommentRow({
  node,
  depth = 0,
  brandPageName,
  canReply,
  sendingId,
  replyingToId,
  getDraft,
  onDraftChange,
  onStartReply,
  onSend,
  onAiDraft,
  onDismiss,
}: Props) {
  const isAuthor = node.isFromBrand;
  const showComposer = canReply && node.status === 'pending' && replyingToId === node.id;
  const displayName = isAuthor && brandPageName ? brandPageName : node.commenterName;
  const displayText = isAuthor ? replyBody(node) : node.commentText;
  const showInlineReply =
    !isAuthor &&
    node.status === 'sent' &&
    Boolean(node.replyText?.trim()) &&
    !hasSyncedBrandReply(node);
  const attachments = node.attachments ?? [];
  const reactions = [
    ...(node.reactions ?? []),
    ...(node.likeCount > 0 ? [{ type: 'like', count: node.likeCount }] : []),
  ];
  const avatarSize = depth > 0 ? 'h-7 w-7' : 'h-9 w-9';

  return (
    <div className="flex gap-2.5 min-w-0">
      <Avatar className={cn(avatarSize, 'shrink-0 mt-0.5 ring-2 ring-background')}>
        {node.commenterAvatarUrl ? (
          <AvatarImage src={node.commenterAvatarUrl} alt={node.commenterName} />
        ) : null}
        <AvatarFallback
          className={cn(
            'text-[10px] font-medium',
            isAuthor ? 'bg-primary/15 text-primary' : 'bg-muted',
          )}
        >
          {initials(node.commenterName)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0 space-y-1">
        <div
          className={cn(
            'rounded-2xl px-3.5 py-2.5 shadow-sm',
            isAuthor
              ? 'bg-primary/8 border border-primary/15'
              : 'bg-muted/60 border border-border/50',
          )}
        >
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span className="text-[13px] font-semibold leading-tight">{displayName}</span>
            {isAuthor && (
              <Badge
                variant="secondary"
                className="text-[10px] h-4 px-1.5 gap-0.5 font-normal bg-primary/15 text-primary border-0"
              >
                <PenLine className="h-2.5 w-2.5" />
                Author
              </Badge>
            )}
            {node.status === 'pending' && !isAuthor && (
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
                Needs reply
              </Badge>
            )}
          </div>

          <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words text-foreground">
            {displayText}
          </p>
          <MessageAttachments items={attachments} className="mt-2" />
          <MessageReactions items={reactions} />
        </div>

        {showInlineReply && (
          <div className="ml-2 mt-2">
            <div
              className={cn(
                'rounded-2xl px-3.5 py-2.5 shadow-sm',
                'bg-primary/8 border border-primary/15',
              )}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[13px] font-semibold">{brandPageName ?? 'Author'}</span>
                <Badge
                  variant="secondary"
                  className="text-[10px] h-4 px-1.5 gap-0.5 font-normal bg-primary/15 text-primary border-0"
                >
                  <PenLine className="h-2.5 w-2.5" />
                  Author
                </Badge>
              </div>
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">
                {node.replyText}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground px-1">
          <span>{formatDistanceToNow(new Date(node.created_at), { addSuffix: true })}</span>
          {canReply && node.status === 'pending' && !isAuthor && (
            <>
              <button
                type="button"
                className="font-semibold hover:text-foreground transition-colors"
                onClick={() => onStartReply(node.id)}
              >
                Reply
              </button>
              <button
                type="button"
                className="hover:text-foreground transition-colors"
                onClick={() => onDismiss(node)}
              >
                Dismiss
              </button>
            </>
          )}
        </div>

        {showComposer && (
          <div className="mt-2 space-y-2">
            <Textarea
              rows={2}
              autoFocus
              placeholder={`Reply as ${brandPageName ?? 'your page'}…`}
              className="text-sm resize-none rounded-xl bg-background border-border/80"
              value={getDraft(node.id)}
              onChange={(e) => onDraftChange(node.id, e.target.value)}
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                size="sm"
                className="h-8 rounded-lg flex-1 sm:flex-none"
                onClick={() => onSend(node)}
                disabled={sendingId === node.id || !getDraft(node.id).trim()}
              >
                {sendingId === node.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 mr-1" /> Reply
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-lg flex-1 sm:flex-none"
                onClick={() => onAiDraft(node)}
                disabled={sendingId === node.id}
              >
                <Bot className="h-3.5 w-3.5 mr-1" /> AI draft
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function CommentThread(props: Props) {
  const { node, depth = 0 } = props;
  const children = visibleChildren(node);
  const [expanded, setExpanded] = useState(depth < 2);
  const hiddenCount = children.length;
  const canCollapse = depth === 0 && hiddenCount > 3;

  return (
    <div className={cn(depth > 0 && 'mt-3')}>
      <CommentRow {...props} />

      {children.length > 0 && (
        <div
          className={cn(
            'relative mt-2 space-y-3',
            depth === 0 ? 'ml-8 sm:ml-12' : 'ml-7 sm:ml-10',
          )}
        >
          <div
            className="absolute left-0 top-0 bottom-3 w-px bg-border"
            aria-hidden
          />

          {canCollapse && !expanded ? (
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline pl-3"
              onClick={() => setExpanded(true)}
            >
              <ChevronDown className="h-3.5 w-3.5" />
              View {hiddenCount} repl{hiddenCount === 1 ? 'y' : 'ies'}
            </button>
          ) : (
            children.map((child) => (
              <div key={child.id} className="pl-3">
                <CommentThread {...props} node={child} depth={depth + 1} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
