import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mailApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { PageContainer } from '@/components/layout/PageContainer';
import { AutoReplyRulesPanel } from '@/components/replies/AutoReplyRulesPanel';
import { PermissionGate } from '@/components/PermissionGate';
import { P } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Link2, Unlink, Loader2, Bot } from 'lucide-react';

const EMAIL_PLATFORM_OPTIONS = ['email'];

interface GmailStatus {
  connected: boolean;
  email?: string | null;
  expiresAt?: string | null;
  smtpConfigured?: boolean;
}

export default function MailDashboardPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

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
      const { redirectUrl } = await mailApi.gmailConnect(returnUrl);
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

  return (
    <PermissionGate require={P.leads.view} fallback={true}>
      <PageContainer>
        <div className="flex items-start gap-3 mb-6">
          <Mail className="h-6 w-6 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold">Mail</h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Connect Gmail to send lead emails from your account, and manage email auto-reply rules.
            </p>
          </div>
        </div>

        <Tabs defaultValue="gmail" className="min-w-0">
          <TabsList className="h-auto flex-wrap justify-start gap-1 p-1">
            <TabsTrigger value="gmail" className="text-xs sm:text-sm">
              <Link2 className="h-3.5 w-3.5 mr-1.5" />
              Gmail
            </TabsTrigger>
            <TabsTrigger value="rules" className="text-xs sm:text-sm">
              <Bot className="h-3.5 w-3.5 mr-1.5" />
              Reply rules
            </TabsTrigger>
          </TabsList>

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
                          ? 'Lead emails and outbound mail will be sent via your connected Gmail account.'
                          : 'Connect Gmail to send emails as yourself. SMTP is used as a fallback when configured.'}
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

          <TabsContent value="rules" className="mt-4">
            <AutoReplyRulesPanel
              platformFilter="email"
              platformOptions={EMAIL_PLATFORM_OPTIONS}
              defaultPlatform="email"
              description="Rules for inbound email auto-replies. The same rules also appear under Replies → Rules."
            />
          </TabsContent>
        </Tabs>
      </PageContainer>
    </PermissionGate>
  );
}
