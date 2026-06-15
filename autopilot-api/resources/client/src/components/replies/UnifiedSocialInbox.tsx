import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Bot, Inbox, Loader2, RefreshCw, Send } from 'lucide-react';
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
import { cn } from '@/lib/utils';

type ChannelFilter = 'all' | 'post_comment' | 'dm';

export function UnifiedSocialInbox() {
  const { tenant } = useTenant();
  const { activeWorkspace, workspaceVersion } = useWorkspace();
  const { can } = usePermissions();
  const { toast } = useToast();

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
      setSelectedId((prev) => prev ?? rows[0]?.id ?? null);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [tenant, activeWorkspace, filter]);

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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1">
          {(['all', 'post_comment', 'dm'] as ChannelFilter[]).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              className="h-7 text-xs capitalize"
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'post_comment' ? 'Post comments' : 'Direct messages'}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={() => void syncAll()} disabled={syncing}>
          {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
          Sync all
        </Button>
      </div>

      {conversations.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm space-y-2">
          <Inbox className="h-8 w-8 mx-auto opacity-40" />
          <p>No conversations yet. Connect platforms and sync your inbox.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-[280px_1fr] gap-4 min-h-[520px]">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="p-3 border-b text-xs font-medium text-muted-foreground">
                {conversations.length} conversation{conversations.length === 1 ? '' : 's'}
              </div>
              <div className="max-h-[560px] overflow-y-auto">
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
                      <div className="flex items-center gap-2">
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
            </CardContent>
          </Card>

          <div className="min-w-0">
            {!selected ? (
              <Card className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Select a conversation
              </Card>
            ) : selected.channel === 'post_comment' && postGroup ? (
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
                fullMedia
              />
            ) : (
              <Card className="flex flex-col overflow-hidden min-h-[520px]">
                <CardContent className="p-0 flex flex-col flex-1">
                  <div className="p-3 border-b flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {selected.platform}
                    </Badge>
                    <span className="text-sm font-medium">
                      {selected.participantName ?? selected.title}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {dmMessages.map((m) => (
                      <div
                        key={m.id}
                        className={cn('flex', m.direction === 'outbound' ? 'justify-end' : 'justify-start')}
                      >
                        <div
                          className={cn(
                            'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
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
                          <div className="flex items-center gap-1.5 mt-1">
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

                  {selected.channel === 'dm' && (
                    <div className="p-3 border-t space-y-2">
                      <Textarea
                        rows={2}
                        placeholder="Reply…"
                        className="resize-none text-sm"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                      />
                      <Button
                        size="sm"
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
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
