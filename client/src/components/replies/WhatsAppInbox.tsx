import { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Bot, Loader2, MessageSquare, Send } from 'lucide-react';
import { whatsappApi } from '@/lib/api';
import { useTenant } from '@/hooks/useTenant';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { MessageAttachments } from './MessageAttachments';
import { MessageReactions } from './MessageReactions';
import { InboxSplitLayout } from '@/components/layout/InboxSplitLayout';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

type Conversation = {
  phone: string;
  lastMessage: string;
  lastAt: string;
  inboundCount: number;
};

type Message = {
  id: string;
  phone: string;
  direction: 'inbound' | 'outbound';
  body: string;
  status: string;
  error_message?: string;
  attachments?: Array<{ url?: string; type?: string; name?: string }>;
  reactions?: Array<{ type: string; count?: number }>;
  created_at: string;
};

export function WhatsAppInbox() {
  const { tenant } = useTenant();
  const { activeWorkspace, workspaceVersion } = useWorkspace();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [useTemplate, setUseTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('hello_world');
  const [templateLanguage, setTemplateLanguage] = useState('en');
  const [templates, setTemplates] = useState<
    Array<{ name: string; language: string; status: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadConversations = useCallback(async () => {
    if (!tenant || !activeWorkspace) return;
    try {
      const rows = await whatsappApi.conversations(tenant.id, activeWorkspace);
      setConversations(rows);
      setSelectedPhone((prev) => {
        if (prev && rows.some((r) => r.phone === prev)) return prev;
        if (isMobile) return null;
        return rows[0]?.phone ?? null;
      });
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [tenant, activeWorkspace, isMobile]);

  const loadMessages = useCallback(async () => {
    if (!tenant || !activeWorkspace || !selectedPhone) {
      setMessages([]);
      return;
    }
    try {
      const rows = await whatsappApi.listMessages(tenant.id, selectedPhone, activeWorkspace);
      setMessages(
        [...rows].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        ),
      );
    } catch {
      setMessages([]);
    }
  }, [tenant, activeWorkspace, selectedPhone]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations, workspaceVersion]);

  useEffect(() => {
    if (!tenant || !activeWorkspace) return;
    void whatsappApi.listTemplates(tenant.id, activeWorkspace).then((res) => {
      const list = res.templates ?? [];
      setTemplates(list);
      if (res.defaultTemplate) setTemplateName(res.defaultTemplate);
      else if (list[0]?.name) setTemplateName(list[0].name);
      if (list[0]?.language) setTemplateLanguage(list[0].language);
    }).catch(() => setTemplates([]));
  }, [tenant, activeWorkspace, workspaceVersion]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  async function sendReply() {
    if (!tenant || !activeWorkspace || !selectedPhone || !replyText.trim()) return;
    setSending(true);
    try {
      const result = await whatsappApi.reply({
        tenantId: tenant.id,
        workspaceId: activeWorkspace,
        phone: selectedPhone,
        message: replyText.trim(),
        useTemplate,
        templateName: useTemplate ? templateName : undefined,
        templateLanguage: useTemplate ? templateLanguage : undefined,
      });
      if (!result.sent) {
        throw new Error(result.message ?? 'Send failed');
      }
      setReplyText('');
      await loadMessages();
      await loadConversations();
      toast({
        title: result.usedTemplate ? 'Template message sent' : 'Message sent',
        description: result.usedTemplate
          ? 'Delivered via approved WhatsApp template (outside 24h window).'
          : undefined,
      });
    } catch (err: unknown) {
      toast({
        title: 'Send failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading WhatsApp…
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground text-sm space-y-2">
        <MessageSquare className="h-8 w-8 mx-auto opacity-40" />
        <p>No WhatsApp messages yet. Inbound DMs appear here when your number is connected.</p>
        <p className="text-xs">Enable auto-reply rules for WhatsApp on the Rules tab.</p>
      </div>
    );
  }

  return (
    <InboxSplitLayout
      hasSelection={Boolean(selectedPhone)}
      onBack={() => setSelectedPhone(null)}
      listMinHeight="min-h-[280px] md:min-h-[480px]"
      detailMinHeight="min-h-[360px] md:min-h-[480px]"
      list={
        <>
          <div className="p-3 border-b text-xs font-medium text-muted-foreground">Conversations</div>
          <div className="max-h-[min(60vh,520px)] md:max-h-[520px] overflow-y-auto">
            {conversations.map((c) => (
              <button
                key={c.phone}
                type="button"
                onClick={() => setSelectedPhone(c.phone)}
                className={cn(
                  'w-full text-left px-3 py-2.5 border-b hover:bg-muted/50 transition-colors',
                  selectedPhone === c.phone && 'bg-primary/5',
                )}
              >
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-sm font-medium truncate">{c.phone}</span>
                  {c.inboundCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {c.inboundCount}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{c.lastMessage}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(c.lastAt), { addSuffix: true })}
                </p>
              </button>
            ))}
          </div>
        </>
      }
      detail={
        !selectedPhone ? (
          <Card className="h-full flex items-center justify-center text-muted-foreground text-sm min-h-[280px]">
            Select a conversation
          </Card>
        ) : (
          <Card className="flex flex-col overflow-hidden flex-1 min-h-0">
            <CardContent className="p-0 flex flex-col flex-1 min-h-0">
              <div className="p-3 border-b flex items-center gap-2 min-w-0">
                <Badge variant="outline" className="text-[10px] shrink-0">WhatsApp</Badge>
                <span className="text-sm font-medium truncate">{selectedPhone}</span>
              </div>

              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 min-h-[200px]">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      'flex',
                      m.direction === 'outbound' ? 'justify-end' : 'justify-start',
                    )}
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
                        {m.status === 'template' && (
                          <Badge variant="outline" className="text-[9px] h-4">
                            template
                          </Badge>
                        )}
                        {m.status === 'failed' && (
                          <Badge variant="destructive" className="text-[9px] h-4" title={m.error_message}>
                            not delivered
                          </Badge>
                        )}
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

              <div className="p-3 border-t space-y-2">
                <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-2">
                  <Checkbox
                    id="wa-use-template"
                    checked={useTemplate}
                    onCheckedChange={(v) => setUseTemplate(v === true)}
                    className="mt-0.5"
                  />
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <Label htmlFor="wa-use-template" className="text-xs font-medium cursor-pointer">
                      Send as template (outside 24h window)
                    </Label>
                    <p className="text-[10px] text-muted-foreground leading-snug">
                      Use when the customer has not messaged recently. Requires a Meta-approved template.
                    </p>
                    {useTemplate && (
                      <Select
                        value={`${templateName}::${templateLanguage}`}
                        onValueChange={(v) => {
                          const [name, lang] = v.split('::');
                          setTemplateName(name);
                          setTemplateLanguage(lang || 'en');
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs mt-1">
                          <SelectValue placeholder="Select template" />
                        </SelectTrigger>
                        <SelectContent>
                          {(templates.length ? templates : [{ name: 'hello_world', language: 'en', status: 'APPROVED' }]).map(
                            (t) => (
                              <SelectItem key={`${t.name}-${t.language}`} value={`${t.name}::${t.language}`}>
                                {t.name} ({t.language})
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
                <Textarea
                  rows={2}
                  placeholder="Reply on WhatsApp…"
                  className="resize-none text-sm"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendReply();
                    }
                  }}
                />
                <Button size="sm" className="w-full sm:w-auto" onClick={() => void sendReply()} disabled={sending || !replyText.trim()}>
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Send className="h-3.5 w-3.5 mr-2" />}
                  Send
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      }
    />
  );
}
