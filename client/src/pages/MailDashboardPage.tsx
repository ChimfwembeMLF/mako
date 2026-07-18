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
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Link2, Unlink, Loader2, Bot, FileText, Inbox } from 'lucide-react';
import { EmailDraftsList } from '@/components/mail/EmailDraftsList';
import { EmailInboxList } from '@/components/mail/EmailInboxList';

const EMAIL_PLATFORM_OPTIONS = ['email'];

interface GmailStatus {
  connected: boolean;
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

  return (
    <PermissionGate require={P.leads.view} fallback={true}>
      <PageContainer>
        <div className="flex items-start gap-3 mb-6">
          <Mail className="h-6 w-6 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold">Email</h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Connect Gmail to send lead emails. Inbox rules create draft replies you review before sending.
            </p>
          </div>
        </div>

        <Tabs defaultValue="inbox" className="min-w-0">
          <TabsList className="h-auto flex-wrap justify-start gap-1 p-1">
            <TabsTrigger value="inbox" className="text-xs sm:text-sm">
              <Inbox className="h-3.5 w-3.5 mr-1.5" />
              Inbox
            </TabsTrigger>
            <TabsTrigger value="gmail" className="text-xs sm:text-sm">
              <Link2 className="h-3.5 w-3.5 mr-1.5" />
              Gmail
            </TabsTrigger>
            <TabsTrigger value="drafts" className="text-xs sm:text-sm">
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Draft replies
            </TabsTrigger>
            <TabsTrigger value="rules" className="text-xs sm:text-sm">
              <Bot className="h-3.5 w-3.5 mr-1.5" />
              Reply rules
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="mt-4">
            <EmailInboxList refreshKey={inboxRefreshKey} />
          </TabsContent>

          <TabsContent value="gmail" className="mt-4 space-y-4">
            <div className="rounded-lg border bg-card p-4 sm:p-6 space-y-4">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading connection status…
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">Gmail connection</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {status?.connected
                          ? 'Outbound mail and inbox rules create Gmail draft replies for your review.'
                          : 'Connect Gmail to send emails and draft inbox replies (requires read + compose permissions).'}
                      </p>
                    </div>
                    <Badge variant={status?.connected ? 'default' : 'secondary'}>
                      {status?.connected ? 'Connected' : 'Not connected'}
                    </Badge>
                  </div>

                  {status?.email && (
                    <p className="text-sm">
                      Account: <span className="font-medium">{status.email}</span>
                    </p>
                  )}

                  {status?.expiresAt && (
                    <p className="text-xs text-muted-foreground">
                      Token expires: {new Date(status.expiresAt).toLocaleString()}
                    </p>
                  )}

                  {status?.smtpConfigured && (
                    <p className="text-xs text-muted-foreground">
                      SMTP fallback is configured on the server.
                    </p>
                  )}

                  {status?.inboxScopeNote && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-2">
                      {status.inboxScopeNote}
                    </p>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    {!status?.connected ? (
                      <Button onClick={() => void connectGmail()} disabled={connecting} className="gap-2">
                        {connecting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Link2 className="h-4 w-4" />
                        )}
                        Connect Gmail
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => void syncInboxNow()}
                          disabled={syncing || !tenant?.id}
                          className="gap-2"
                        >
                          {syncing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Bot className="h-4 w-4" />
                          )}
                          Check inbox now
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => void disconnectGmail()}
                          disabled={disconnecting}
                          className="gap-2"
                        >
                          {disconnecting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Unlink className="h-4 w-4" />
                          )}
                          Disconnect Gmail
                        </Button>
                      </>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground border-t pt-4">
                    If you signed up with Google, Gmail may already be connected from login.
                    Email/password users can connect here without changing their login method.
                  </p>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="drafts" className="mt-4">
            <EmailDraftsList refreshKey={draftRefreshKey} />
          </TabsContent>

          <TabsContent value="rules" className="mt-4">
            <AutoReplyRulesPanel
              platformFilter="email"
              platformOptions={EMAIL_PLATFORM_OPTIONS}
              defaultPlatform="email"
              description="Rules match inbound Gmail messages by keyword. New unread emails get draft replies in Gmail every few minutes — nothing is sent until you approve."
            />
          </TabsContent>
        </Tabs>
      </PageContainer>
    </PermissionGate>
  );
}
