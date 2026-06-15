import React, { useCallback, useEffect, useState } from 'react';
import {
  autoReplyRulesApi,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PermissionGate } from '@/components/PermissionGate';
import { PostCommentInbox } from '@/components/replies/PostCommentInbox';
import { WhatsAppInbox } from '@/components/replies/WhatsAppInbox';
import { UnifiedSocialInbox } from '@/components/replies/UnifiedSocialInbox';
import {
  MessageSquareReply,
  Bot,
  Plus,
  Trash2,
  Save,
  Send,
  Loader2,
  MessagesSquare,
  Inbox,
} from 'lucide-react';
import { autoReplyPlatforms } from '@/lib/platform-capabilities';

const PLATFORMS = autoReplyPlatforms().map((p) => p.id);
const SENTIMENTS = ['any', 'positive', 'negative', 'neutral'];

interface ReplyRule {
  id: string;
  tenant_id: string;
  platform: string;
  name: string;
  trigger_keywords: string[];
  trigger_sentiment: string;
  response_template: string | null;
  ai_generate: boolean;
  is_active: boolean;
}

const BLANK_RULE: Omit<ReplyRule, 'id' | 'tenant_id'> = {
  platform: 'facebook',
  name: '',
  trigger_keywords: [],
  trigger_sentiment: 'any',
  response_template: '',
  ai_generate: true,
  is_active: true,
};

function fromRule(row: Record<string, unknown>): ReplyRule {
  return {
    id: String(row.id),
    tenant_id: String(row.tenantId),
    platform: String(row.platform),
    name: String(row.name),
    trigger_keywords: (row.triggerKeywords as string[]) ?? [],
    trigger_sentiment: String(row.triggerSentiment ?? 'any'),
    response_template: row.responseTemplate != null ? String(row.responseTemplate) : null,
    ai_generate: Boolean(row.aiGenerate),
    is_active: Boolean(row.isActive),
  };
}

function toRulePayload(editing: Partial<ReplyRule>, tenantId: string, workspaceId: string) {
  return {
    tenantId,
    workspaceId,
    platform: editing.platform,
    name: editing.name,
    triggerKeywords: editing.trigger_keywords,
    triggerSentiment: editing.trigger_sentiment,
    responseTemplate: editing.response_template,
    aiGenerate: editing.ai_generate,
    isActive: editing.is_active,
  };
}

function countPending(posts: PostInboxGroup[]) {
  return posts.reduce((sum, p) => sum + p.pendingCount, 0);
}

export default function RepliesPage() {
  const { tenant } = useTenant();
  const { activeWorkspace, workspaceVersion } = useWorkspace();
  const { can } = usePermissions();
  const { toast } = useToast();

  const [posts, setPosts] = useState<PostInboxGroup[]>([]);
  const [rules, setRules] = useState<ReplyRule[]>([]);
  const [editing, setEditing] = useState<Partial<ReplyRule> | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [manualText, setManualText] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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

  const loadRules = useCallback(async () => {
    if (!tenant || !activeWorkspace) return;
    try {
      const all = await autoReplyRulesApi.findAll(tenant.id, activeWorkspace);
      const list = Array.isArray(all) ? all : [];
      setRules(list.map(fromRule));
    } catch {
      setRules([]);
    }
  }, [tenant, activeWorkspace]);

  useEffect(() => {
    if (tenant && activeWorkspace) {
      void loadInbox();
      void loadRules();
    }
  }, [tenant?.id, activeWorkspace, workspaceVersion, loadInbox, loadRules]);

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

  async function saveRule() {
    if (!editing?.name?.trim() || !tenant || !activeWorkspace) return;
    setSaving(true);
    try {
      const payload = toRulePayload(editing, tenant.id, activeWorkspace);
      if (editing.id) {
        await autoReplyRulesApi.update(editing.id, payload as any);
        setRules((prev) => prev.map((r) => (r.id === editing.id ? { ...r, ...editing } as ReplyRule : r)));
        toast({ title: 'Rule saved' });
      } else {
        const data = await autoReplyRulesApi.create(payload as any);
        setRules((prev) => [...prev, fromRule(data as Record<string, unknown>)]);
        toast({ title: 'Rule created' });
      }
      await logAudit({ tenantId: tenant.id, action: editing.id ? 'reply_rule.updated' : 'reply_rule.created' });
      setEditing(null);
      setKeyInput('');
    } catch (err: unknown) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
    setSaving(false);
  }

  async function deleteRule(id: string) {
    if (!tenant) return;
    try {
      await autoReplyRulesApi.remove(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
      await logAudit({ tenantId: tenant.id, action: 'reply_rule.deleted', resourceId: id });
      toast({ title: 'Rule deleted' });
    } catch (err: unknown) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
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

  const addKeyword = () => {
    if (!keyInput.trim() || !editing) return;
    setEditing((e) => ({
      ...e!,
      trigger_keywords: [...(e!.trigger_keywords ?? []), keyInput.trim()],
    }));
    setKeyInput('');
  };

  const pendingCount = countPending(posts);
  const activeRules = rules.filter((r) => r.is_active).length;

  return (
    <PermissionGate require={P.replies.view} fallback={true}>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <MessageSquareReply className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold">Replies</h1>
              <p className="text-sm text-muted-foreground">
                Unified inbox for all platforms — comments, DMs, attachments, and auto-replies.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void fetchComments()} disabled={fetching}>
            {fetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {fetching ? 'Syncing…' : 'Pull comments'}
          </Button>
        </div>

        <Tabs defaultValue="inbox">
          <TabsList>
            <TabsTrigger value="inbox">
              <Inbox className="h-3.5 w-3.5 mr-1.5" />
              All inbox
            </TabsTrigger>
            <TabsTrigger value="comments">
              Post comments{pendingCount > 0 ? ` (${pendingCount})` : ''}
            </TabsTrigger>
            <TabsTrigger value="messages">
              <MessagesSquare className="h-3.5 w-3.5 mr-1.5" />
              WhatsApp
            </TabsTrigger>
            <TabsTrigger value="rules">
              Auto-reply rules{activeRules > 0 ? ` (${activeRules} on)` : ''}
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

          <TabsContent value="rules" className="space-y-4 mt-4">
            <p className="text-xs text-muted-foreground">
              Rules match inbound comments and WhatsApp messages by keyword. Toggle a rule on to enable
              auto-replies (AI or template). New tenants get starter rules — activate them here.
            </p>

            <PermissionGate require={P.replies.manageRules}>
              <div className="rounded-lg border bg-card p-4 space-y-4">
                <p className="font-medium text-sm">{editing?.id ? 'Edit rule' : 'New auto-reply rule'}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Rule name</Label>
                    <Input
                      value={editing?.name ?? ''}
                      onChange={(e) => setEditing((p) => ({ ...(p ?? BLANK_RULE), name: e.target.value }))}
                      placeholder="e.g. Positive comment thanks"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Platform</Label>
                    <Select
                      value={editing?.platform ?? 'facebook'}
                      onValueChange={(v) => setEditing((p) => ({ ...(p ?? BLANK_RULE), platform: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PLATFORMS.map((p) => (
                          <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Sentiment trigger</Label>
                    <Select
                      value={editing?.trigger_sentiment ?? 'any'}
                      onValueChange={(v) => setEditing((p) => ({ ...(p ?? BLANK_RULE), trigger_sentiment: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SENTIMENTS.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Keywords (any match)</Label>
                    <div className="flex gap-2">
                      <Input
                        value={keyInput}
                        onChange={(e) => setKeyInput(e.target.value)}
                        placeholder="Add keyword"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addKeyword();
                          }
                        }}
                      />
                      <Button size="sm" onClick={addKeyword} type="button">
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(editing?.trigger_keywords ?? []).map((kw) => (
                        <Badge
                          key={kw}
                          variant="secondary"
                          className="gap-1 cursor-pointer"
                          onClick={() =>
                            setEditing((p) => ({
                              ...p!,
                              trigger_keywords: p!.trigger_keywords!.filter((k) => k !== kw),
                            }))
                          }
                        >
                          {kw} ×
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label>Response template (when AI is off)</Label>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">AI generate</span>
                      <Switch
                        checked={editing?.ai_generate ?? true}
                        onCheckedChange={(v) => setEditing((p) => ({ ...(p ?? BLANK_RULE), ai_generate: v }))}
                      />
                    </div>
                  </div>
                  <Textarea
                    rows={3}
                    value={editing?.response_template ?? ''}
                    placeholder="e.g. Thank you for your kind comment!"
                    onChange={(e) =>
                      setEditing((p) => ({ ...(p ?? BLANK_RULE), response_template: e.target.value }))
                    }
                    className="resize-none text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => void saveRule()}
                    disabled={saving || !editing?.name?.trim()}
                    className="gap-1"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {editing?.id ? 'Save changes' : 'Create rule'}
                  </Button>
                  {editing && (
                    <Button size="sm" variant="outline" onClick={() => { setEditing(null); setKeyInput(''); }}>
                      Cancel
                    </Button>
                  )}
                  {!editing && (
                    <Button size="sm" variant="outline" onClick={() => setEditing({ ...BLANK_RULE })}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> New rule
                    </Button>
                  )}
                </div>
              </div>
            </PermissionGate>

            <div className="space-y-2">
              {rules.length === 0 && (
                <div className="py-8 text-center text-muted-foreground text-sm">No rules yet.</div>
              )}
              {rules.map((rule) => (
                <div key={rule.id} className="rounded-lg border bg-card p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{rule.name}</p>
                      <Badge variant="outline" className="text-[10px] capitalize">{rule.platform}</Badge>
                      {rule.ai_generate && (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <Bot className="h-3 w-3" /> AI
                        </Badge>
                      )}
                      {!rule.is_active && (
                        <Badge variant="secondary" className="text-[10px]">inactive</Badge>
                      )}
                    </div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {rule.trigger_keywords.map((kw) => (
                        <Badge key={kw} variant="outline" className="text-[10px]">{kw}</Badge>
                      ))}
                      {rule.trigger_keywords.length === 0 && (
                        <Badge variant="outline" className="text-[10px]">catch-all</Badge>
                      )}
                      {rule.trigger_sentiment !== 'any' && (
                        <Badge variant="secondary" className="text-[10px]">{rule.trigger_sentiment}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={rule.is_active}
                      disabled={!can(P.replies.manageRules)}
                      onCheckedChange={async (v) => {
                        await autoReplyRulesApi.update(rule.id, { isActive: v } as any);
                        void loadRules();
                      }}
                    />
                    <PermissionGate require={P.replies.manageRules}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(rule);
                          setKeyInput('');
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void deleteRule(rule.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </PermissionGate>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGate>
  );
}
