import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mailApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { useWorkspace } from '@/hooks/useWorkspace';
import { PageContainer } from '@/components/layout/PageContainer';
import { AutoReplyRulesPanel } from '@/components/replies/AutoReplyRulesPanel';
import { PermissionGate } from '@/components/PermissionGate';
import { P } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertTriangle, Check, Loader2, Mail, MoreHorizontal, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmailDraftsList } from '@/components/mail/EmailDraftsList';
import { EmailInboxList } from '@/components/mail/EmailInboxList';

const EMAIL_PLATFORM_OPTIONS = ['email'];

interface GmailStatus {
  connected: boolean;
  /** Gmail was linked but the access has expired and cannot renew itself. */
  needsReconnect?: boolean;
  email?: string | null;
  expiresAt?: string | null;
  smtpConfigured?: boolean;
  inboxAutoReply?: boolean;
  inboxScopeNote?: string | null;
}

export default function MailDashboardPage() {
  const { toast } = useToast();
  const { tenant } = useTenant();
  const { activeWorkspace } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [inboxRefreshKey, setInboxRefreshKey] = useState(0);
  const [draftRefreshKey, setDraftRefreshKey] = useState(0);
  const [tab, setTab] = useState('inbox');
  const [newCount, setNewCount] = useState<number | null>(null);
  const [draftCount, setDraftCount] = useState<number | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await mailApi.gmailStatus();
      setStatus(data);
    } catch (err: unknown) {
      setStatus(null);
      toast({
        title: 'Could not load mail status',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (searchParams.get('connected') === '1') {
      toast({ title: 'Gmail connected', description: 'Your account can now send email via Gmail.' });
      searchParams.delete('connected');
      setSearchParams(searchParams, { replace: true });
      void loadStatus();
    }
    const error = searchParams.get('error');
    if (error) {
      toast({ title: 'Gmail connection failed', description: error, variant: 'destructive' });
      searchParams.delete('error');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, toast, loadStatus]);

  async function connectGmail() {
    setConnecting(true);
    try {
      const returnUrl = `${window.location.origin}/mail`;
      const { redirectUrl } = await mailApi.gmailConnect({
        returnUrl,
        tenantId: tenant?.id,
        workspaceId: activeWorkspace ?? undefined,
      });
      window.location.href = redirectUrl;
    } catch (err: unknown) {
      toast({
        title: 'Could not start Gmail connection',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
      setConnecting(false);
    }
  }

  async function disconnectGmail() {
    setDisconnecting(true);
    try {
      await mailApi.gmailDisconnect();
      toast({ title: 'Gmail disconnected' });
      await loadStatus();
    } catch (err: unknown) {
      toast({
        title: 'Disconnect failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setDisconnecting(false);
    }
  }

  async function syncInboxNow() {
    if (!tenant?.id) return;
    setSyncing(true);
    try {
      const result = await mailApi.gmailSync(tenant.id);
      toast({
        title: 'Inbox checked',
        description: `Synced ${result.processed} message(s), created ${result.drafted} draft(s).`,
      });
      setInboxRefreshKey((k) => k + 1);
      setDraftRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      toast({
        title: 'Inbox sync failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  }

  const connected = Boolean(status?.connected);

  return (
    <PermissionGate require={P.leads.view} fallback={true}>
      <PageContainer>
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">Email</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Customer emails from your Gmail, with replies drafted for you to check and send.
          </p>
        </div>

        <ConnectionStrip
          loading={loading}
          status={status}
          connecting={connecting}
          disconnecting={disconnecting}
          syncing={syncing}
          canSync={Boolean(tenant?.id)}
          onConnect={() => void connectGmail()}
          onDisconnect={() => void disconnectGmail()}
          onSync={() => void syncInboxNow()}
        />

        <Tabs value={tab} onValueChange={setTab} className="mt-6 min-w-0">
          <TabsList className="h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-0 border-b border-border bg-transparent p-0">
            {[
              { value: 'inbox', label: 'Inbox', count: newCount, hint: 'new' },
              { value: 'drafts', label: 'Draft replies', count: draftCount, hint: 'to review' },
              { value: 'rules', label: 'Reply rules', count: null, hint: '' },
            ].map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="relative -mb-px h-10 rounded-none border-b-2 border-transparent bg-transparent px-0 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                {t.label}
                {t.count ? (
                  <span
                    className="ml-2 rounded-full bg-primary px-1.5 py-px text-[10px] font-semibold tabular-nums text-primary-foreground"
                    aria-label={`${t.count} ${t.hint}`}
                  >
                    {t.count}
                  </span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="inbox" className="mt-5">
            <EmailInboxList
              refreshKey={inboxRefreshKey}
              onCount={setNewCount}
              connected={connected}
              onConnect={() => void connectGmail()}
            />
          </TabsContent>

          <TabsContent value="drafts" className="mt-5">
            <EmailDraftsList refreshKey={draftRefreshKey} onCount={setDraftCount} onOpenRules={() => setTab('rules')} />
          </TabsContent>

          <TabsContent value="rules" className="mt-5">
            <AutoReplyRulesPanel
              platformFilter="email"
              platformOptions={EMAIL_PLATFORM_OPTIONS}
              defaultPlatform="email"
              description="When a new email matches a rule, Mako writes a reply and saves it as a Gmail draft. Nothing is sent until you send it."
            />
          </TabsContent>
        </Tabs>
      </PageContainer>
    </PermissionGate>
  );
}

function ConnectionStrip({
  loading,
  status,
  connecting,
  disconnecting,
  syncing,
  canSync,
  onConnect,
  onDisconnect,
  onSync,
}: {
  loading: boolean;
  status: GmailStatus | null;
  connecting: boolean;
  disconnecting: boolean;
  syncing: boolean;
  canSync: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onSync: () => void;
}) {
  if (loading) {
    return <div className="h-[72px] animate-pulse rounded-xl border bg-card/60" aria-label="Loading Gmail connection" />;
  }

  if (status?.connected) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            <Check className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              Gmail connected<span className="font-normal text-muted-foreground"> · {status.email}</span>
            </p>
            <p className="text-xs text-muted-foreground">Lead emails and team invitations send from this address.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onSync} disabled={syncing || !canSync}>
            <RefreshCw className={cn('h-3.5 w-3.5', syncing && 'animate-spin')} />
            {syncing ? 'Checking…' : 'Check inbox now'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Gmail connection options">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={onConnect} disabled={connecting} className="flex-col items-start gap-0.5">
                <span>Reconnect Gmail</span>
                <span className="text-[11px] text-muted-foreground">If inbox sync or drafts stop working</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDisconnect} disabled={disconnecting} className="text-destructive focus:text-destructive">
                Disconnect Gmail
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  if (status?.needsReconnect) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3.5 dark:border-amber-500/30 dark:bg-amber-500/10 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-950 dark:text-amber-100">Gmail access has expired</p>
            <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
              Lead emails and team invitations can’t send from {status.email ?? 'your address'} until you reconnect. It only takes a moment and won’t expire again.
            </p>
          </div>
        </div>
        <Button size="sm" className="h-9 shrink-0" onClick={onConnect} disabled={connecting}>
          {connecting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Reconnect Gmail
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-5 rounded-xl border bg-card p-5 sm:p-6 md:grid-cols-[1fr_auto] md:items-center">
      <div className="flex gap-4">
        <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:flex">
          <Mail className="h-5 w-5" />
        </span>
        <div>
          <p className="font-display text-base font-semibold">Connect your Gmail</p>
          <ul className="mt-2 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-3 sm:gap-4">
            <li className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />Send lead emails from your own address</li>
            <li className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />Email team invitations</li>
            <li className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />Get draft replies to customer emails</li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Mako only drafts replies; nothing is sent from your inbox without you. Your sign-in method doesn’t change.
          </p>
        </div>
      </div>
      <Button onClick={onConnect} disabled={connecting} className="shrink-0">
        {connecting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
        Connect Gmail
      </Button>
    </div>
  );
}
