import React, { useCallback, useEffect, useState } from 'react';
import {
  commentRepliesApi,
  contentPublicationsApi,
  resolveQueued,
  type CommentInboxNode,
  type PostInboxGroup,
} from '@/lib/api';
import { useTenant } from '@/hooks/useTenant';
import { useWorkspace } from '@/hooks/useWorkspace';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { PermissionGate } from '@/components/PermissionGate';
import { PostCommentInbox } from '@/components/replies/PostCommentInbox';
import { WhatsAppInbox } from '@/components/replies/WhatsAppInbox';
import { UnifiedSocialInbox } from '@/components/replies/UnifiedSocialInbox';
import { AutoReplyRulesPanel } from '@/components/replies/AutoReplyRulesPanel';
import { PageContainer } from '@/components/layout/PageContainer';
import {
  MessageSquareReply,
  Send,
  Loader2,
  MessagesSquare,
  Inbox,
} from 'lucide-react';

function countPending(posts: PostInboxGroup[]) {
  return posts.reduce((sum, p) => sum + p.pendingCount, 0);
}

export default function RepliesPage() {
  const { tenant } = useTenant();
  const { activeWorkspace, workspaceVersion } = useWorkspace();
  const { can } = usePermissions();
  const { toast } = useToast();

  const [posts, setPosts] = useState<PostInboxGroup[]>([]);
  const [manualText, setManualText] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [loadingInbox, setLoadingInbox] = useState(true);

  const loadInbox = useCallback(async () => {
    if (!tenant || !activeWorkspace) return;
    setLoadingInbox(true);
    try {
      const { posts: rows } = await commentRepliesApi.inbox(tenant.id, undefined, activeWorkspace);
      setPosts(rows);
    } catch {
      setPosts([]);
    } finally {
      setLoadingInbox(false);
    }
  }, [tenant, activeWorkspace]);

  useEffect(() => {
    if (tenant && activeWorkspace) {
      void loadInbox();
    }
  }, [tenant?.id, activeWorkspace, workspaceVersion, loadInbox]);

  async function fetchComments() {
    if (!tenant || !activeWorkspace) return;
    setFetching(true);
    try {
      const raw = await commentRepliesApi.fetch(tenant.id, activeWorkspace);
      const result = (await resolveQueued(raw)) as { fetched?: number; autoReplied?: number };
      const count = result?.fetched ?? 0;
      const autoReplied = result?.autoReplied ?? 0;

      let engagementUpdated = 0;
      try {
        const eng = await contentPublicationsApi.syncEngagement(tenant.id, activeWorkspace ?? undefined);
        engagementUpdated = eng?.updated ?? 0;
      } catch {
        /* engagement sync is best-effort */
      }

      const parts = [
        count > 0 ? `${count} new comment${count !== 1 ? 's' : ''} pulled` : 'No new comments found',
        autoReplied > 0 ? `${autoReplied} auto-replied` : null,
        engagementUpdated > 0 ? `metrics updated for ${engagementUpdated} post${engagementUpdated !== 1 ? 's' : ''}` : null,
      ].filter(Boolean);
      toast({ title: 'Comments synced', description: parts.join(' · ') });
      await loadInbox();
    } catch (err: unknown) {
      toast({
        title: 'Fetch failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setFetching(false);
    }
  }

  async function sendReply(node: CommentInboxNode) {
    const text = manualText[node.id];
    if (!text?.trim() || !tenant) return;
    setSending(node.id);
    try {
      await commentRepliesApi.send(node.id, text);
      await logAudit({ tenantId: tenant.id, action: 'reply.sent', resourceId: node.id });
      toast({ title: 'Reply sent to platform' });
      setManualText((prev) => {
        const next = { ...prev };
        delete next[node.id];
        return next;
      });
      await loadInbox();
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

  async function generateAiReply(node: CommentInboxNode) {
    if (!tenant) return;
    setSending(node.id);
    try {
      const raw = await commentRepliesApi.suggest(node.id);
      const data = (await resolveQueued(raw)) as { content?: string };
      const text = data?.content ?? '';
      if (!text.trim()) {
        toast({ title: 'No suggestion', description: 'AI returned an empty reply.', variant: 'destructive' });
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
  }

  async function dismissComment(node: CommentInboxNode) {
    await commentRepliesApi.update(node.id, { status: 'dismissed' } as any);
    await loadInbox();
  }

  const pendingCount = countPending(posts);

  return (
    <PermissionGate require={P.replies.view} fallback={true}>
      <PageContainer>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <MessageSquareReply className="h-6 w-6 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold">Replies</h1>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Unified inbox for all platforms — comments, DMs, attachments, and auto-replies.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full sm:w-auto shrink-0" onClick={() => void fetchComments()} disabled={fetching}>
            {fetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {fetching ? 'Syncing…' : 'Pull comments'}
          </Button>
        </div>

        <Tabs defaultValue="inbox" className="min-w-0">
          <TabsList className="h-auto flex-wrap justify-start gap-1 p-1">
            <TabsTrigger value="inbox" className="text-xs sm:text-sm">
              <Inbox className="h-3.5 w-3.5 mr-1.5" />
              All inbox
            </TabsTrigger>
            <TabsTrigger value="comments" className="text-xs sm:text-sm">
              Comments{pendingCount > 0 ? ` (${pendingCount})` : ''}
            </TabsTrigger>
            <TabsTrigger value="messages" className="text-xs sm:text-sm">
              <MessagesSquare className="h-3.5 w-3.5 mr-1.5" />
              WhatsApp
            </TabsTrigger>
            <TabsTrigger value="rules" className="text-xs sm:text-sm">
              Rules
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="mt-4">
            <UnifiedSocialInbox key={`${activeWorkspace}-${workspaceVersion}`} />
          </TabsContent>

          <TabsContent value="comments" className="mt-4">
            {loadingInbox ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading inbox…
              </div>
            ) : (
              <PostCommentInbox
                posts={posts}
                canReply={can(P.replies.create)}
                sendingId={sending}
                manualText={manualText}
                onDraftChange={(id, text) => setManualText((p) => ({ ...p, [id]: text }))}
                onSend={(node) => void sendReply(node)}
                onAiDraft={(node) => void generateAiReply(node)}
                onDismiss={(node) => void dismissComment(node)}
              />
            )}
          </TabsContent>

          <TabsContent value="messages" className="mt-4">
            <WhatsAppInbox key={`${activeWorkspace}-${workspaceVersion}`} />
          </TabsContent>

          <TabsContent value="rules" className="mt-4">
            <AutoReplyRulesPanel
              description="Rules match inbound comments, WhatsApp messages, and email by keyword. Toggle a rule on to enable auto-replies (AI or template). Email rules are also managed on the Mail dashboard."
            />
          </TabsContent>
        </Tabs>
      </PageContainer>
    </PermissionGate>
  );
}
