import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  MessageCircle,
  Link2,
  CheckCircle2,
  Circle,
  XCircle,
  Copy,
  Check,
  Loader2,
  LayoutTemplate,
  Phone,
  UserPlus,
  RefreshCw,
  Inbox,
  Bot,
  ChevronDown,
  Code2,
  LifeBuoy,
  Star,
  Workflow,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { useTenant } from '@/hooks/useTenant';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/use-toast';
import { resolveApiBaseUrl, whatsappApi, whatsappBotsApi, whatsappContactsApi, whatsappTemplatesApi } from '@/lib/api';
import type { WhatsappBot } from '@/components/whatsapp/bot-builder/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { WhatsappMenuBotPanel } from '@/components/whatsapp/WhatsappMenuBotPanel';
import { cn } from '@/lib/utils';

type ConnectionStatus = Awaited<ReturnType<typeof whatsappApi.connectionStatus>>;
type Conversation = Awaited<ReturnType<typeof whatsappApi.conversations>>[number];

/** A folded section: summary always visible, details on demand. */
function Disclosure({ icon: Icon, title, children, defaultOpen = false }: {
  icon: typeof Code2; title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="border-border/60">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-5 py-4 text-left text-sm font-semibold"
      >
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1">{title}</span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && <CardContent className="space-y-3 pt-0 text-sm">{children}</CardContent>}
    </Card>
  );
}

export default function WhatsappHubPage() {
  const { tenant } = useTenant();
  const { activeWorkspace } = useWorkspace();
  const { toast } = useToast();
  const tenantId = tenant?.id ?? '';
  // activeWorkspace is already the workspace id.
  const workspaceId = activeWorkspace ?? undefined;

  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [templateCount, setTemplateCount] = useState<number | null>(null);
  const [botEnabled, setBotEnabled] = useState(false);
  const [bots, setBots] = useState<WhatsappBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [contactPhone, setContactPhone] = useState('');
  const [contactName, setContactName] = useState('');
  const [addingContact, setAddingContact] = useState(false);
  const [importingTemplates, setImportingTemplates] = useState(false);

  const webhookUrl = useMemo(() => {
    const fromApi = status?.webhookUrl?.trim();
    if (fromApi && fromApi.startsWith('http')) return fromApi;
    const base = resolveApiBaseUrl().replace(/\/$/, '');
    return base ? `${base}/api/v1/webhooks/meta` : '/api/v1/webhooks/meta';
  }, [status?.webhookUrl]);

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [conn, templates, convos, flow, botList] = await Promise.all([
        whatsappApi.connectionStatus(tenantId, workspaceId),
        whatsappTemplatesApi.list(tenantId, workspaceId).catch(() => []),
        whatsappApi.conversations(tenantId, workspaceId).catch(() => []),
        whatsappApi.getFlowConfig(tenantId, workspaceId).catch(() => null),
        whatsappBotsApi.list(tenantId, workspaceId).catch(() => []),
      ]);
      setBots(Array.isArray(botList) ? botList : []);
      setStatus(conn);
      setTemplateCount(Array.isArray(templates) ? templates.length : 0);
      setConversations(Array.isArray(convos) ? convos : []);
      setBotEnabled(Boolean(flow?.enabled));
    } catch (err: unknown) {
      setStatus(null);
      toast({
        title: 'Could not load WhatsApp status',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenantId, workspaceId, toast]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const navigate = useNavigate();
  const [converting, setConverting] = useState(false);
  async function convertMenuBot() {
    if (!tenantId) return;
    setConverting(true);
    try {
      const bot = await whatsappBotsApi.create({ tenantId, workspaceId, name: 'Menu bot', template: 'from_menu_bot' });
      navigate(`/whatsapp/bots/${bot.id}`);
    } catch (e) {
      toast({ title: 'Could not convert the menu bot', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
      setConverting(false);
    }
  }

  const [copiedChatLink, setCopiedChatLink] = useState(false);
  async function copyChatLink() {
    if (!status?.chatLink) return;
    try {
      await navigator.clipboard.writeText(status.chatLink);
      setCopiedChatLink(true);
      setTimeout(() => setCopiedChatLink(false), 2000);
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  }

  async function copyWebhook() {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  }

  async function addContact() {
    if (!tenantId || !contactPhone.trim()) return;
    setAddingContact(true);
    try {
      await whatsappContactsApi.create({
        tenantId,
        workspaceId,
        phone: contactPhone.trim(),
        name: contactName.trim() || undefined,
        optedIn: true,
      });
      toast({ title: 'Contact added', description: 'You can message them from the Inbox or Leads.' });
      setContactPhone('');
      setContactName('');
    } catch (err: unknown) {
      toast({
        title: 'Could not add contact',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setAddingContact(false);
    }
  }

  async function importAllTemplates() {
    if (!tenantId) return;
    setImportingTemplates(true);
    try {
      const res = await whatsappTemplatesApi.importAll(tenantId, workspaceId);
      toast({
        title: 'Templates imported from Meta',
        description: `${res.imported} imported, ${res.skipped} skipped (not approved yet).`,
      });
      const rows = await whatsappTemplatesApi.list(tenantId, workspaceId);
      setTemplateCount(Array.isArray(rows) ? rows.length : 0);
    } catch (err: unknown) {
      toast({
        title: 'Import failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setImportingTemplates(false);
    }
  }

  const connected = Boolean(status?.connected && status?.tokenValid !== false);
  const tokenExpired = Boolean(status?.connected && status?.tokenValid === false);
  const receiving = conversations.length > 0;
  const needsWebhook = !status?.platformManaged;
  const liveBots = bots.filter((b) => b.status === 'live');
  // A live visual bot, or the classic menu bot, means customers get automatic answers.
  const answering = liveBots.length > 0 || botEnabled;

  const steps = [
    {
      key: 'connect',
      title: 'Connect your number',
      done: connected,
      hint: connected ? status?.displayPhoneNumber ?? 'Connected' : 'Link your WhatsApp Business number',
      action: !connected && (
        <Button asChild size="sm"><Link to="/publisher">Connect</Link></Button>
      ),
    },
    {
      key: 'receive',
      title: 'Receive messages',
      done: receiving,
      hint: receiving ? 'Messages are arriving' : 'Send your number a test message',
      action: !receiving && connected && needsWebhook && (
        <Button size="sm" variant="outline" onClick={() => document.getElementById('wa-developer-setup')?.scrollIntoView({ behavior: 'smooth' })}>
          Set up webhook
        </Button>
      ),
    },
    {
      key: 'templates',
      title: 'Import templates',
      done: (templateCount ?? 0) > 0,
      hint: (templateCount ?? 0) > 0 ? `${templateCount} ready to use` : 'Needed to message people first',
      action: (templateCount ?? 0) === 0 && connected && (
        <Button size="sm" variant="outline" disabled={importingTemplates} onClick={() => void importAllTemplates()}>
          {importingTemplates ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Pull from Meta'}
        </Button>
      ),
    },
    {
      key: 'bot',
      title: 'Put a bot live',
      done: answering,
      hint: answering ? `${liveBots.length || 1} bot${liveBots.length > 1 ? 's' : ''} answering customers` : 'Answer customers automatically',
      action: !answering && (
        <Button asChild size="sm" variant="outline"><Link to="/whatsapp/bots">Build a bot</Link></Button>
      ),
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <PageContainer>
      <div>
        <h1 className="font-display text-2xl font-bold">WhatsApp</h1>
        <p className="text-sm text-muted-foreground">Your business number, automatic replies and message templates.</p>
      </div>
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Status */}
          <Card className="overflow-hidden border-border/60">
            <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex items-center gap-4 min-w-0">
                <div className={cn(
                  'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl',
                  connected ? 'bg-[#25D366] text-white' : 'bg-muted text-muted-foreground',
                )}>
                  <MessageCircle className="h-7 w-7" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-xl font-bold tabular-nums">
                      {connected ? status?.displayPhoneNumber ?? 'WhatsApp Business' : 'No number connected'}
                    </p>
                    <span className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                      connected
                        ? 'bg-green-600/10 text-green-700 dark:text-green-400'
                        : tokenExpired
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                          : 'bg-muted text-muted-foreground',
                    )}>
                      {connected ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {connected ? 'Connected' : tokenExpired ? 'Reconnect needed' : 'Not connected'}
                    </span>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {connected
                      ? `${status?.accountName ?? 'WhatsApp Business'}${status?.platformManaged ? ' · managed by Mako' : ''}`
                      : status?.message ?? 'Connect your WhatsApp Business number to start messaging customers.'}
                  </p>
                  {!connected && status?.graphError && (
                    <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{status.graphError}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {connected ? (
                  <>
                    <Button asChild className="gap-1.5">
                      <Link to="/replies?tab=messages"><Inbox className="h-4 w-4" /> Open WhatsApp inbox</Link>
                    </Button>
                    <Button asChild variant="outline" className="gap-1.5">
                      <Link to="/publisher"><Link2 className="h-4 w-4" /> Manage</Link>
                    </Button>
                  </>
                ) : (
                  <Button asChild className="gap-1.5">
                    <Link to="/publisher"><Link2 className="h-4 w-4" /> {tokenExpired ? 'Reconnect' : 'Connect WhatsApp'}</Link>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Refresh status"
                  title="Refresh status"
                  disabled={refreshing}
                  onClick={() => { setRefreshing(true); void load(); }}
                >
                  <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
                </Button>
              </div>
            </CardContent>
            {connected && status?.chatLink && (
              <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/30 px-5 py-3 sm:flex-row sm:items-center sm:px-6">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Chat link for customers</p>
                  <p className="text-xs text-muted-foreground">
                    {status.platformManaged
                      ? 'This number is shared, so share this link: it tells Mako which business a new customer is writing to.'
                      : 'Put it on your website, bio and posts so customers can message you in one tap.'}
                  </p>
                </div>
                <div className="flex min-w-0 items-center gap-2 sm:w-[26rem]">
                  <Input readOnly value={status.chatLink} className="h-8 font-mono text-xs" aria-label="Chat link" />
                  <Button size="sm" variant="outline" className="h-8 shrink-0 gap-1.5" onClick={() => void copyChatLink()}>
                    {copiedChatLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedChatLink ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Setup checklist, until everything is done */}
          {doneCount < steps.length && (
            <Card className="border-border/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <div>
                  <CardTitle className="text-base">Get set up</CardTitle>
                  <CardDescription>{doneCount} of {steps.length} done</CardDescription>
                </div>
                <div className="flex h-2 w-32 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div className="h-full rounded-full bg-[#25D366]" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
                </div>
              </CardHeader>
              <CardContent>
                <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {steps.map((step, i) => (
                    <li
                      key={step.key}
                      className={cn(
                        'flex flex-col gap-3 rounded-xl border p-4',
                        step.done ? 'border-green-600/20 bg-green-600/5' : 'border-border/60',
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        {step.done
                          ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                          : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">
                            <span className="sr-only">Step {i + 1}: </span>{step.title}
                          </p>
                          <p className="text-xs text-muted-foreground">{step.hint}</p>
                        </div>
                      </div>
                      {step.action && <div className="mt-auto">{step.action}</div>}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
            <div className="min-w-0 space-y-6 lg:col-span-2">
              <Card className="border-border/60">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-base">Recent conversations</CardTitle>
                    <CardDescription>
                      {receiving ? `${conversations.length} customer${conversations.length === 1 ? '' : 's'} have messaged you` : 'Nobody has messaged this number yet.'}
                    </CardDescription>
                  </div>
                  {receiving && (
                    <Button asChild variant="ghost" size="sm">
                      <Link to="/replies?tab=messages">View all</Link>
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  {receiving ? (
                    <ul className="divide-y divide-border/60">
                      {conversations.slice(0, 6).map((c) => (
                        <li key={c.phone}>
                          <Link to="/replies?tab=messages" className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-muted/40">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366]/15 text-[#128C7E]">
                              <Phone className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium tabular-nums">{c.phone}</span>
                              <span className="block truncate text-xs text-muted-foreground">{c.lastMessage}</span>
                            </span>
                            <span className="shrink-0 text-right text-xs text-muted-foreground">
                              {c.lastAt ? formatDistanceToNow(new Date(c.lastAt), { addSuffix: true }) : ''}
                              <span className="block">{c.inboundCount} message{c.inboundCount === 1 ? '' : 's'}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="px-6 pb-6 text-sm text-muted-foreground">
                      {connected
                        ? 'Send a WhatsApp message to your business number from your own phone. If it doesn’t show up here within a minute, see “Messages not arriving?” below.'
                        : 'Once your number is connected, customer conversations appear here.'}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base"><Workflow className="h-4 w-4" /> Bots</CardTitle>
                    <CardDescription>Drag-and-drop conversations and AI agents. Keywords decide which bot answers.</CardDescription>
                  </div>
                  <Button asChild size="sm" className="shrink-0"><Link to="/whatsapp/bots">{bots.length ? 'Manage bots' : 'Build a bot'}</Link></Button>
                </CardHeader>
                <CardContent className="p-0">
                  {bots.length === 0 ? (
                    <p className="px-6 pb-6 text-sm text-muted-foreground">
                      No bots yet. Start with an AI agent that answers from your documents, or convert the menu bot below into a flow you can edit.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border/60">
                      {bots.slice(0, 5).map((b) => (
                        <li key={b.id}>
                          <Link to={`/whatsapp/bots/${b.id}`} className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-muted/40">
                            <span className={cn('h-2 w-2 shrink-0 rounded-full', b.status === 'live' ? 'bg-green-600' : 'bg-muted-foreground/50')} aria-hidden />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                                {b.isDefault && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" aria-label="Default" />}
                                {b.name}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {b.triggers.length ? b.triggers.join(', ') : b.isDefault ? 'Answers every message' : 'No keywords'}
                              </span>
                            </span>
                            <span className="text-xs text-muted-foreground">{b.status === 'live' ? 'Live' : 'Draft'}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <div id="wa-menu-bot" className="scroll-mt-24">
                <Disclosure icon={Bot} title={liveBots.length ? 'Classic menu bot (off while a bot is live)' : 'Classic menu bot (older)'}>
                  <div className="mb-4 flex flex-col gap-2 rounded-lg border border-dashed border-border/80 bg-muted/30 p-3 sm:flex-row sm:items-center">
                    <p className="flex-1 text-xs text-muted-foreground">
                      The menu bot is being replaced by visual bots. Convert it to keep your options and add AI, questions and handoffs. It stops answering once a visual bot is live.
                    </p>
                    <Button size="sm" variant="outline" className="shrink-0 gap-1.5" disabled={converting} onClick={() => void convertMenuBot()}>
                      {converting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Workflow className="h-3.5 w-3.5" />}
                      Convert to visual bot
                    </Button>
                  </div>
                  {tenantId && <WhatsappMenuBotPanel tenantId={tenantId} workspaceId={workspaceId} compact />}
                </Disclosure>
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base"><LayoutTemplate className="h-4 w-4" /> Message templates</CardTitle>
                  <CardDescription>Meta-approved messages you can send anytime, even after the 24-hour reply window closes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="font-display text-3xl font-bold tabular-nums">
                    {templateCount ?? '—'}
                    <span className="ml-1.5 text-sm font-normal text-muted-foreground">saved in Mako</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={!connected || importingTemplates} onClick={() => void importAllTemplates()}>
                      {importingTemplates ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                      Pull from Meta
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link to="/whatsapp/templates">Manage</Link>
                    </Button>
                  </div>
                  {!connected && <p className="text-xs text-muted-foreground">Connect WhatsApp first.</p>}
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base"><UserPlus className="h-4 w-4" /> Add a contact</CardTitle>
                  <CardDescription>Save a customer who agreed to hear from you.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    className="space-y-3"
                    onSubmit={(e) => { e.preventDefault(); void addContact(); }}
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="wa-contact-phone">Phone number</Label>
                      <Input id="wa-contact-phone" inputMode="tel" placeholder="+260 97 123 4567" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
                      <p className="text-xs text-muted-foreground">Include the country code.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="wa-contact-name">Name <span className="font-normal text-muted-foreground">(optional)</span></Label>
                      <Input id="wa-contact-name" placeholder="Jane Banda" value={contactName} onChange={(e) => setContactName(e.target.value)} />
                    </div>
                    <Button type="submit" size="sm" className="w-full" disabled={!contactPhone.trim() || addingContact}>
                      {addingContact ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                      Add contact
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Disclosure icon={LifeBuoy} title="Messages not arriving?">
                <ul className="space-y-2.5 text-muted-foreground">
                  <li>
                    <span className="font-medium text-foreground">Connected but no messages:</span>{' '}
                    {needsWebhook
                      ? 'Meta must be told where to send messages. Set the webhook under Developer setup.'
                      : 'Ask Mako support to check the number’s webhook.'}
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Testing in Meta’s sandbox:</span>{' '}
                    add your test phone numbers to Meta’s allowed list first.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Can’t reply:</span>{' '}
                    normal replies only work within 24 hours of the customer’s last message. After that, send an approved template.
                  </li>
                </ul>
              </Disclosure>

              {needsWebhook && (
                <div id="wa-developer-setup" className="scroll-mt-24">
                  <Disclosure icon={Code2} title="Developer setup (webhook)" defaultOpen={connected && !receiving}>
                    <p className="text-muted-foreground">
                      In Meta for Developers → WhatsApp → Configuration, paste this callback URL, verify the token, and subscribe to the <code className="text-xs">messages</code> field.
                    </p>
                    <div className="flex gap-2">
                      <Input readOnly value={webhookUrl} className="font-mono text-xs" aria-label="Webhook URL" />
                      <Button type="button" variant="outline" size="icon" onClick={() => void copyWebhook()} aria-label="Copy webhook URL">
                        {copiedWebhook ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    {status?.phoneNumberId && (
                      <p className="text-xs text-muted-foreground">
                        Phone number ID: <span className="font-mono">{status.phoneNumberId}</span>
                      </p>
                    )}
                  </Disclosure>
                </div>
              )}

              <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
                <Bot className="h-3.5 w-3.5" /> The menu bot replies on its own; you can always take over from the Inbox.
              </p>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
