import React, { useEffect, useState } from 'react';
import { autoReplyRulesApi, commentRepliesApi } from '@/lib/api';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { useTenant } from '@/hooks/useTenant';
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
import { MessageSquareReply, Bot, Plus, Trash2, Save, Send, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { autoReplyPlatforms, commentReplyPlatforms } from '@/lib/platform-capabilities';

const PLATFORMS = autoReplyPlatforms().map((p) => p.id);
const COMMENT_PLATFORMS = commentReplyPlatforms().map((p) => p.id);
const SENTIMENTS = ['any','positive','negative','neutral'];

interface ReplyRule {
  id: string; tenant_id: string; platform: string; name: string;
  trigger_keywords: string[]; trigger_sentiment: string;
  response_template: string | null; ai_generate: boolean; is_active: boolean;
}
interface PostReply {
  id: string; platform: string; commenter_name: string | null; comment_text: string;
  reply_text: string | null; reply_type: string | null; status: string; created_at: string;
}

const BLANK_RULE: Omit<ReplyRule,'id'|'tenant_id'> = {
  platform:'facebook', name:'', trigger_keywords:[], trigger_sentiment:'any',
  response_template:'', ai_generate:true, is_active:true,
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

function toRulePayload(editing: Partial<ReplyRule>, tenantId: string) {
  return {
    tenantId,
    platform: editing.platform,
    name: editing.name,
    triggerKeywords: editing.trigger_keywords,
    triggerSentiment: editing.trigger_sentiment,
    responseTemplate: editing.response_template,
    aiGenerate: editing.ai_generate,
    isActive: editing.is_active,
  };
}

function fromReply(row: Record<string, unknown>): PostReply {
  return {
    id: String(row.id),
    platform: String(row.platform),
    commenter_name: row.commenterName != null ? String(row.commenterName) : null,
    comment_text: String(row.commentText ?? ''),
    reply_text: row.replyText != null ? String(row.replyText) : null,
    reply_type: row.replyType != null ? String(row.replyType) : null,
    status: String(row.status ?? 'pending'),
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

export default function RepliesPage() {
  const { tenant } = useTenant();
  const { can }    = usePermissions();
  const { toast }  = useToast();
  const [rules,   setRules]   = useState<ReplyRule[]>([]);
  const [replies, setReplies] = useState<PostReply[]>([]);
  const [editing, setEditing] = useState<Partial<ReplyRule> | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [manualText, setManualText] = useState<Record<string,string>>({});
  const [sending, setSending] = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => { if (tenant) { loadRules(); loadReplies(); } }, [tenant]);

  async function loadRules() {
    if (!tenant) return;
    try {
      const all = await autoReplyRulesApi.findAll();
      const list = Array.isArray(all) ? all : [];
      setRules(
        list
          .filter((r: Record<string, unknown>) => r.tenantId === tenant.id)
          .map(fromRule),
      );
    } catch {
      setRules([]);
    }
  }

  async function loadReplies() {
    if (!tenant) return;
    try {
      const all = await commentRepliesApi.findAll();
      const list = Array.isArray(all) ? all : [];
      setReplies(
        list
          .filter((r: Record<string, unknown>) => r.tenantId === tenant.id)
          .map(fromReply)
          .slice(0, 50),
      );
    } catch {
      setReplies([]);
    }
  }

  async function fetchComments() {
    if (!tenant) return;
    setFetching(true);
    const { data, error } = await invokeEdgeFunction('fetch-comments', { body: { tenantId: tenant.id } });
    setFetching(false);
    if (error) { toast({ title: 'Fetch failed', description: error.message, variant: 'destructive' }); return; }
    const count = (data as { fetched?: number } | null)?.fetched ?? 0;
    toast({ title: 'Comments synced', description: count > 0 ? `${count} new comment${count !== 1 ? 's' : ''} pulled.` : 'No new comments found.' });
    if (count > 0) loadReplies();
  }

  async function saveRule() {
    if (!editing?.name?.trim() || !tenant) return;
    setSaving(true);
    try {
      const payload = toRulePayload(editing, tenant.id);
      if (editing.id) {
        await autoReplyRulesApi.update(editing.id, payload as any);
        setRules(prev => prev.map(r => r.id === editing.id ? { ...r, ...editing } as ReplyRule : r));
        toast({ title: 'Rule saved' });
      } else {
        const data = await autoReplyRulesApi.create(payload as any);
        setRules(prev => [...prev, fromRule(data as Record<string, unknown>)]);
        toast({ title: 'Rule created' });
      }
      await logAudit({ tenantId: tenant.id, action: editing.id ? 'reply_rule.updated' : 'reply_rule.created' });
      setEditing(null); setKeyInput('');
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  }

  async function deleteRule(id: string) {
    if (!tenant) return;
    try {
      await autoReplyRulesApi.remove(id);
      setRules(prev => prev.filter(r => r.id !== id));
      await logAudit({ tenantId: tenant.id, action: 'reply_rule.deleted', resourceId: id });
      toast({ title: 'Rule deleted' });
    } catch (err: unknown) {
      toast({ title: 'Delete failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    }
  }

  async function sendReply(reply: PostReply) {
    const text = manualText[reply.id];
    if (!text?.trim() || !tenant) return;
    setSending(reply.id);
    try {
      await commentRepliesApi.send(reply.id, text);
      await logAudit({ tenantId: tenant.id, action: 'reply.sent', resourceId: reply.id });
      toast({ title: 'Reply sent' });
      setReplies(prev => prev.map(r => r.id === reply.id ? { ...r, reply_text: text, status: 'sent', reply_type: 'manual' } : r));
      setManualText(prev => { const n = { ...prev }; delete n[reply.id]; return n; });
    } catch (err: any) {
      toast({ title: 'Send failed', description: err.message, variant: 'destructive' });
    }
    setSending(null);
  }

  async function generateAiReply(reply: PostReply) {
    if (!tenant) return;
    setSending(reply.id);
    try {
      const { data } = await invokeEdgeFunction('generate-content', {
        body: { contentType: 'reply', theme: reply.comment_text, platform: reply.platform, tenant_id: tenant.id },
      });
      const text = (data as { content?: string } | null)?.content ?? '';
      setManualText(prev => ({ ...prev, [reply.id]: text }));
    } catch {}
    setSending(null);
  }

  const addKeyword = () => {
    if (!keyInput.trim() || !editing) return;
    setEditing(e => ({ ...e!, trigger_keywords: [...(e!.trigger_keywords ?? []), keyInput.trim()] }));
    setKeyInput('');
  };

  const STATUS_ICON: Record<string, JSX.Element> = {
    pending:   <Clock className="h-3.5 w-3.5 text-amber-500"/>,
    sent:      <CheckCircle2 className="h-3.5 w-3.5 text-green-500"/>,
    failed:    <XCircle className="h-3.5 w-3.5 text-red-500"/>,
    dismissed: <XCircle className="h-3.5 w-3.5 text-muted-foreground"/>,
  };

  return (
    <PermissionGate require={P.replies.view} fallback={true}>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <MessageSquareReply className="h-6 w-6 text-primary"/>
            <div>
              <h1 className="text-2xl font-semibold">Replies</h1>
              <p className="text-sm text-muted-foreground">Manage AI auto-reply rules and manual replies to social comments.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchComments} disabled={fetching}>
            {fetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {fetching ? 'Syncing...' : 'Pull Latest Comments'}
          </Button>
        </div>

        <Tabs defaultValue="queue">
          <TabsList>
            <TabsTrigger value="queue">Reply Queue {replies.filter(r=>r.status==='pending').length > 0 && `(${replies.filter(r=>r.status==='pending').length})`}</TabsTrigger>
            <TabsTrigger value="rules">Auto-Reply Rules</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="space-y-4 mt-4">
            {replies.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm">No comments yet.</div>
            ) : replies.map(reply => (
              <div key={reply.id} className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{reply.commenter_name ?? 'Anonymous'}</p>
                      <Badge variant="outline" className="text-[10px] capitalize">{reply.platform}</Badge>
                      {STATUS_ICON[reply.status]}
                    </div>
                    <p className="text-sm mt-1 text-muted-foreground">"{reply.comment_text}"</p>
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(reply.created_at), {addSuffix:true})}
                  </p>
                </div>
                {reply.status === 'sent' && reply.reply_text && (
                  <div className="bg-green-50 dark:bg-green-950/20 rounded p-2 text-xs">
                    <strong>Replied:</strong> {reply.reply_text}
                  </div>
                )}
                {reply.status === 'pending' && can(P.replies.create) && (
                  <div className="space-y-2">
                    <Textarea rows={2} placeholder="Type your reply…" className="text-sm resize-none"
                      value={manualText[reply.id] ?? reply.reply_text ?? ''}
                      onChange={e => setManualText(p => ({ ...p, [reply.id]: e.target.value }))} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => sendReply(reply)} disabled={sending===reply.id || !manualText[reply.id]?.trim()} className="gap-1">
                        <Send className="h-3.5 w-3.5"/> Send
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => generateAiReply(reply)} disabled={sending===reply.id} className="gap-1">
                        <Bot className="h-3.5 w-3.5"/> AI Draft
                      </Button>
                      <Button size="sm" variant="ghost" onClick={async()=>{
                        await commentRepliesApi.update(reply.id, { status: 'dismissed' } as any);
                        loadReplies();
                      }}>
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="rules" className="space-y-4 mt-4">
            <PermissionGate require={P.replies.manageRules}>
              <div className="rounded-lg border bg-card p-4 space-y-4">
                <p className="font-medium text-sm">{editing?.id ? 'Edit rule' : 'New auto-reply rule'}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Rule name</Label>
                    <Input value={editing?.name ?? ''} onChange={e => setEditing(p => ({...(p??BLANK_RULE),name:e.target.value}))} placeholder="e.g. Positive comment thanks" />
                  </div>
                  <div className="space-y-1">
                    <Label>Platform</Label>
                    <Select value={editing?.platform ?? 'facebook'} onValueChange={v => setEditing(p => ({...(p??BLANK_RULE),platform:v}))}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>{PLATFORMS.map(p=><SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Sentiment trigger</Label>
                    <Select value={editing?.trigger_sentiment ?? 'any'} onValueChange={v => setEditing(p => ({...(p??BLANK_RULE),trigger_sentiment:v}))}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>{SENTIMENTS.map(s=><SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Keywords (any match)</Label>
                    <div className="flex gap-2">
                      <Input value={keyInput} onChange={e=>setKeyInput(e.target.value)} placeholder="Add keyword" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addKeyword();}}} />
                      <Button size="sm" onClick={addKeyword} type="button"><Plus className="h-3.5 w-3.5"/></Button>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(editing?.trigger_keywords ?? []).map(kw=>(
                        <Badge key={kw} variant="secondary" className="gap-1 cursor-pointer"
                          onClick={()=>setEditing(p=>({...p!,trigger_keywords:p!.trigger_keywords!.filter(k=>k!==kw)}))}>
                          {kw} ×
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label>Response template (used when AI is off)</Label>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">AI generate</span>
                      <Switch checked={editing?.ai_generate ?? true} onCheckedChange={v=>setEditing(p=>({...(p??BLANK_RULE),ai_generate:v}))} />
                    </div>
                  </div>
                  <Textarea rows={3} value={editing?.response_template ?? ''} placeholder="e.g. Thank you for your kind comment! 😊"
                    onChange={e=>setEditing(p=>({...(p??BLANK_RULE),response_template:e.target.value}))} className="resize-none text-sm" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveRule} disabled={saving || !editing?.name?.trim()} className="gap-1">
                    <Save className="h-3.5 w-3.5"/> {editing?.id ? 'Save Changes' : 'Create Rule'}
                  </Button>
                  {editing && <Button size="sm" variant="outline" onClick={()=>{setEditing(null);setKeyInput('');}}>Cancel</Button>}
                </div>
              </div>
            </PermissionGate>

            <div className="space-y-2">
              {rules.length === 0 && <div className="py-8 text-center text-muted-foreground text-sm">No rules yet.</div>}
              {rules.map(rule => (
                <div key={rule.id} className="rounded-lg border bg-card p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{rule.name}</p>
                      <Badge variant="outline" className="text-[10px] capitalize">{rule.platform}</Badge>
                      {rule.ai_generate && <Badge variant="secondary" className="text-[10px] gap-1"><Bot className="h-3 w-3"/>AI</Badge>}
                    </div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {rule.trigger_keywords.map(kw=><Badge key={kw} variant="outline" className="text-[10px]">{kw}</Badge>)}
                      {rule.trigger_sentiment !== 'any' && <Badge variant="secondary" className="text-[10px]">{rule.trigger_sentiment}</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={rule.is_active} disabled={!can(P.replies.manageRules)}
                      onCheckedChange={async v => {
                        await autoReplyRulesApi.update(rule.id, { isActive: v } as any);
                        loadRules();
                      }} />
                    <PermissionGate require={P.replies.manageRules}>
                      <Button variant="ghost" size="sm" onClick={()=>{setEditing(rule);setKeyInput('');}}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={()=>deleteRule(rule.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5"/>
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
