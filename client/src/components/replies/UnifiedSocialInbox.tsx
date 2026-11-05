import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Bot, Inbox, Loader2, MessageSquare, MessagesSquare, RefreshCw, Send } from 'lucide-react';
import {
  commentRepliesApi,
  inboxApi,
  resolveQueued,
  type CommentInboxNode,
  type PostInboxGroup,
  type UnifiedConversation,
  type UnifiedMessage,
} from '@/lib/api';
import { platformOf } from '@/lib/platforms';
import { useTenant } from '@/hooks/useTenant';
import { useWorkspace } from '@/hooks/useWorkspace';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/lib/permissions';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { PostCommentCard } from './PostCommentCard';
import { MessageAttachments } from './MessageAttachments';
import { MessageReactions } from './MessageReactions';
import { InboxSplitLayout } from '@/components/layout/InboxSplitLayout';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

type ChannelFilter = 'all' | 'post_comment' | 'dm';

export function UnifiedSocialInbox() {
  const { tenant } = useTenant();
  const { activeWorkspace, workspaceVersion } = useWorkspace();
  const { can } = usePermissions();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [filter, setFilter] = useState<ChannelFilter>('all');
  const [conversations, setConversations] = useState<UnifiedConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dmMessages, setDmMessages] = useState<UnifiedMessage[]>([]);
  const [postGroup, setPostGroup] = useState<PostInboxGroup | null>(null);
  const [manualText, setManualText] = useState<Record<string, string>>({});
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  // Open each conversation at its newest message, and follow new ones as they arrive.
  useEffect(() => {
    // After paint, so the new messages are measured.
    const frame = requestAnimationFrame(() => {
      const el = messagesRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedId, dmMessages.length]);

  const loadConversations = useCallback(async () => {
    if (!tenant || !activeWorkspace) return;
    setLoading(true);
    try {
      const rows = await inboxApi.conversations(
        tenant.id,
        filter === 'all' ? 'all' : filter,
        activeWorkspace,
      );
      setConversations(rows);
      setSelectedId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev;
        if (isMobile) return null;
        return rows[0]?.id ?? null;
      });
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [tenant, activeWorkspace, filter, isMobile]);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const loadDetail = useCallback(async () => {
    if (!tenant || !selected) {
      setDmMessages([]);
      setPostGroup(null);
      return;
    }

    if (selected.channel === 'post_comment' && selected.contentId) {
      const { posts } = await commentRepliesApi.inbox(tenant.id, selected.contentId, activeWorkspace);
      const match =
        posts.find((p) => p.key === selected.postKey) ??
        posts.find((p) => p.platform === selected.platform) ??
        posts[0] ??
        null;
      setPostGroup(match);
      setDmMessages([]);
      return;
    }

    setPostGroup(null);
    try {
      const rows = await inboxApi.messages(tenant.id, selected.id, activeWorkspace);
      setDmMessages(rows);
    } catch {
      setDmMessages([]);
    }
  }, [tenant, activeWorkspace, selected]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations, workspaceVersion]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  // A draft belongs to one conversation; never carry it to the next person.
  useEffect(() => {
    setReplyText('');
  }, [selectedId]);

  async function syncAll() {
    if (!tenant || !activeWorkspace) return;
    setSyncing(true);
    try {
      const [dm, raw] = await Promise.all([
        inboxApi.sync(tenant.id, activeWorkspace ?? undefined),
        commentRepliesApi.fetch(tenant.id, activeWorkspace ?? undefined),
      ]);
      await resolveQueued(raw);
      toast({
        title: 'Inbox synced',
        description: `${dm.synced} DM${dm.synced !== 1 ? 's' : ''} · comments updated`,
      });
      await loadConversations();
      await loadDetail();
    } catch (err: unknown) {
      toast({
        title: 'Sync failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  }

  async function sendDmReply() {
    if (!tenant || !selected || !replyText.trim()) return;
    setSending('dm');
    try {
      const result = await inboxApi.reply(tenant.id, selected.id, replyText.trim(), {
        workspaceId: activeWorkspace ?? undefined,
      });
      if (!result.sent) throw new Error(result.message ?? 'Send failed');
      setReplyText('');
      await loadDetail();
      await loadConversations();
      toast({ title: 'Message sent' });
    } catch (err: unknown) {
      toast({
        title: 'Send failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setSending(null);
    }
  }

  async function draftDmReply() {
    if (!tenant || !selected) return;
    setSending('dm-draft');
    try {
      const { content } = await inboxApi.draft(tenant.id, selected.id, activeWorkspace ?? undefined);
      if (content?.trim()) setReplyText(content.trim());
    } catch (err: unknown) {
      toast({
        title: 'AI draft failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setSending(null);
    }
  }

  async function sendCommentReply(node: CommentInboxNode) {
    const text = manualText[node.id];
    if (!text?.trim()) return;
    setSending(node.id);
    try {
      await commentRepliesApi.send(node.id, text);
      setManualText((p) => {
        const next = { ...p };
        delete next[node.id];
        return next;
      });
      await loadDetail();
      await loadConversations();
      toast({ title: 'Reply sent' });
    } catch (err: unknown) {
      toast({
        title: 'Send failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setSending(null);
    }
  }

  const canReply = can(P.replies.create);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading inbox…
      </div>
    );
  }

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {(['all', 'post_comment', 'dm'] as ChannelFilter[]).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              className="h-7 text-xs capitalize flex-1 sm:flex-none min-w-0"
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'post_comment' ? 'Comments' : 'Messages'}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => void syncAll()} disabled={syncing}>
          {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
          Sync all
        </Button>
      </div>

      {conversations.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-background/50 p-6 text-center space-y-2">
          <Inbox className="h-6 w-6 mx-auto text-muted-foreground" />
          <h3 className="font-semibold text-sm text-foreground">
            {filter === 'dm'
              ? 'No messages yet'
              : filter === 'post_comment'
                ? 'No comments yet'
                : 'No conversations yet'}
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Comments on posts you published and Direct messages to your connected Facebook Page and
            Instagram account show up here. Click Sync all to fetch the latest, or connect an account in
            Social accounts.
          </p>
          <div className="flex justify-center gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => void syncAll()} disabled={syncing}>
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Sync all
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href="/publisher">Social accounts</a>
            </Button>
          </div>
        </div>
      ) : (
        <InboxSplitLayout
          hasSelection={Boolean(selected)}
          onBack={() => setSelectedId(null)}
          list={
            <>
              <div className="p-3 border-b text-xs font-medium text-muted-foreground">
                {conversations.length} conversation{conversations.length === 1 ? '' : 's'}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {conversations.map((c) => {
                  const plat = platformOf(c.platform);
                  const Icon = plat.icon;
                  const badge = c.pendingCount || c.unreadCount;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 border-b hover:bg-muted/50 transition-colors',
                        selectedId === c.id && 'bg-primary/5',
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: plat.color }} />
                        <span className="text-sm font-medium truncate flex-1">{c.title}</span>
                        {badge > 0 && (
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            {badge}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5 pl-5">{c.preview}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 pl-5">
                        {formatDistanceToNow(new Date(c.lastAt), { addSuffix: true })}
                        {' · '}
                        {c.channel === 'post_comment' ? 'comments' : 'DM'}
                      </p>
                    </button>
                  );
                })}
              </div>
            </>
          }
          detail={
            !selected ? (
              <Card className="h-full flex items-center justify-center text-muted-foreground text-sm min-h-[280px]">
                Select a conversation
              </Card>
            ) : selected.channel === 'post_comment' && postGroup ? (
              <div className="space-y-3 min-h-0 flex flex-col h-full overflow-y-auto pr-1">
                <div className="flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground uppercase tracking-wide shrink-0">
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                  Post comments
                </div>
                <PostCommentCard
                  post={postGroup}
                  canReply={canReply}
                  sendingId={sending}
                  manualText={manualText}
                  onDraftChange={(id, text) => setManualText((p) => ({ ...p, [id]: text }))}
                  onSend={(node) => void sendCommentReply(node)}
                  onAiDraft={async (node) => {
                    setSending(node.id);
                    try {
                      const raw = await commentRepliesApi.suggest(node.id);
                      const data = (await resolveQueued(raw)) as { content?: string };
                      if (data?.content) {
                        setManualText((p) => ({ ...p, [node.id]: data.content! }));
                      }
                    } finally {
                      setSending(null);
                    }
                  }}
                  onDismiss={async (node) => {
                    await commentRepliesApi.update(node.id, { status: 'dismissed' } as never);
                    await loadDetail();
                  }}
                  hideViewLink
                />
              </div>
            ) : (
              <Card className="flex flex-col overflow-hidden flex-1 min-h-0 h-full">
                <CardContent className="p-0 flex flex-col flex-1 min-h-0">
                  <div className="p-3 border-b flex items-center gap-2 min-w-0 bg-muted/20">
                    <MessagesSquare className="h-4 w-4 text-primary shrink-0" />
                    <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                      {selected.platform}
                    </Badge>
                    <span className="text-sm font-medium truncate">
                      {selected.participantName ?? selected.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0">Direct message</span>
                  </div>

                  <div ref={messagesRef} className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-3 min-h-0">
                    {dmMessages.map((m) => (
                      <div
                        key={m.id}
                        className={cn('flex', m.direction === 'outbound' ? 'justify-end' : 'justify-start')}
                      >
                        <div
                          className={cn(
                            'max-w-[92%] sm:max-w-[85%] rounded-2xl px-3 py-2 text-sm',
                            m.direction === 'outbound'
                              ? m.status === 'auto_reply'
                                ? 'bg-primary/15 border border-primary/25 rounded-br-sm'
                                : 'bg-primary text-primary-foreground rounded-br-sm'
                              : 'bg-muted rounded-bl-sm',
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          <MessageAttachments items={m.attachments ?? []} />
                          <MessageReactions items={m.reactions ?? []} />
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="text-[10px] opacity-70">
                              {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                            </span>
                            {m.status === 'auto_reply' && (
                              <Badge variant="secondary" className="text-[9px] h-4 gap-0.5">
                                <Bot className="h-2.5 w-2.5" /> auto
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selected.channel === 'dm' && canReply && (
                    <div className="p-3 border-t space-y-2 shrink-0">
                      <Textarea
                        rows={3}
                        placeholder={`Reply to ${selected.participantName ?? selected.title}…`}
                        className="resize-none text-sm"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            void sendDmReply();
                          }
                        }}
                        disabled={sending === 'dm'}
                      />
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <Button
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() => void sendDmReply()}
                          disabled={sending === 'dm' || !replyText.trim()}
                        >
                          {sending === 'dm' ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                          ) : (
                            <Send className="h-3.5 w-3.5 mr-2" />
                          )}
                          Send
                        </Button>
                        {selected.platform !== 'whatsapp' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() => void draftDmReply()}
                            disabled={sending === 'dm-draft' || sending === 'dm'}
                          >
                            {sending === 'dm-draft' ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                            ) : (
                              <Bot className="h-3.5 w-3.5 mr-2" />
                            )}
                            AI draft
                          </Button>
                        )}
                        <span className="text-[10px] text-muted-foreground sm:ml-auto">
                          Ctrl/⌘ + Enter to send
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          }
        />
      )}
    </div>
  );
}
