import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageCircle,
  Link2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Loader2,
  MessageSquareReply,
  LayoutTemplate,
  Phone,
  UserPlus,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { useTenant } from '@/hooks/useTenant';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/use-toast';
import { resolveApiBaseUrl, whatsappApi, whatsappContactsApi, whatsappTemplatesApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { WhatsappMenuBotPanel } from '@/components/whatsapp/WhatsappMenuBotPanel';

type ConnectionStatus = Awaited<ReturnType<typeof whatsappApi.connectionStatus>>;

export default function WhatsappHubPage() {
  const { tenant } = useTenant();
  const { activeWorkspace } = useWorkspace();
  const { toast } = useToast();
  const tenantId = tenant?.id ?? '';
  const workspaceId = activeWorkspace?.id;

  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [contactPhone, setContactPhone] = useState('');
  const [contactName, setContactName] = useState('');
  const [addingContact, setAddingContact] = useState(false);
  const [importingTemplates, setImportingTemplates] = useState(false);
  const [templateCount, setTemplateCount] = useState<number | null>(null);

  const webhookUrl = useMemo(() => {
    const fromApi = status?.webhookUrl?.trim();
    if (fromApi && fromApi.startsWith('http')) return fromApi;
    const base = resolveApiBaseUrl().replace(/\/$/, '');
    return base ? `${base}/api/v1/webhooks/meta` : '/api/v1/webhooks/meta';
  }, [status?.webhookUrl]);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [conn, localTemplates] = await Promise.all([
        whatsappApi.connectionStatus(tenantId, workspaceId),
        whatsappTemplatesApi.list(tenantId, workspaceId).catch(() => []),
      ]);
      setStatus(conn);
      setTemplateCount(Array.isArray(localTemplates) ? localTemplates.length : 0);
    } catch (err: unknown) {
      setStatus(null);
      toast({
        title: 'Could not load WhatsApp status',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [tenantId, workspaceId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

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
      toast({ title: 'Contact added', description: 'You can message them from Social Inbox or Leads.' });
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
        description: `${res.imported} imported, ${res.skipped} skipped (non-approved).`,
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

  const connected = status?.connected && status?.tokenValid !== false;

  return (
    <PageContainer
      title="WhatsApp"
      description="Connect your number, configure the menu bot, and troubleshoot messaging."
    >
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading WhatsApp…
        </div>
      ) : (
        <div className="space-y-6 max-w-4xl">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MessageCircle className="h-5 w-5" />
                    Connection
                  </CardTitle>
                  <CardDescription>
                    OAuth in Connections links your Meta WhatsApp Business number to Mako.
                  </CardDescription>
                </div>
                <Badge variant={connected ? 'default' : 'secondary'}>
                  {connected ? 'Connected' : 'Not connected'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {connected ? (
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">Number</span>
                    <p className="font-medium">{status?.displayPhoneNumber ?? '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Account</span>
                    <p className="font-medium truncate">{status?.accountName ?? 'WhatsApp Business'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone number ID</span>
                    <p className="font-mono text-xs break-all">{status?.phoneNumberId ?? '—'}</p>
                  </div>
                  {status?.platformManaged && (
                    <div>
                      <span className="text-muted-foreground">Mode</span>
                      <p className="font-medium">Platform-managed</p>
                    </div>
                  )}
                </div>
              ) : (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>WhatsApp is not ready</AlertTitle>
                  <AlertDescription>
                    {status?.message ??
                      'Connect WhatsApp in Connections and select your business phone number.'}
                    {status?.graphError && (
                      <p className="mt-2 text-xs font-mono break-all">{status.graphError}</p>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-wrap gap-2">
                <Button asChild variant={connected ? 'outline' : 'default'} size="sm">
                  <Link to="/publisher">
                    <Link2 className="h-4 w-4 mr-1.5" />
                    {connected ? 'Manage in Connections' : 'Connect in Connections'}
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void load()}>
                  Refresh status
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Webhook (required for receiving messages)</CardTitle>
              <CardDescription>
                In Meta Developer Console → WhatsApp → Configuration, set this callback URL and verify the token.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input readOnly value={webhookUrl} className="font-mono text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={() => void copyWebhook()}>
                  {copiedWebhook ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Subscribe to <strong>messages</strong> field. Without this webhook, Mako cannot receive inbound
                messages or open the 24-hour reply window.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <LayoutTemplate className="h-5 w-5" />
                Message templates
              </CardTitle>
              <CardDescription>
                Pull approved templates from Meta (including defaults like hello_world) into Mako for replies and broadcasts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {templateCount === null
                  ? '—'
                  : `${templateCount} template${templateCount === 1 ? '' : 's'} saved in Mako`}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={!connected || importingTemplates}
                  onClick={() => void importAllTemplates()}
                >
                  {importingTemplates ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <LayoutTemplate className="h-4 w-4 mr-1.5" />
                  )}
                  Pull all from Meta
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/whatsapp/templates">Manage templates</Link>
                </Button>
              </div>
              {!connected && (
                <p className="text-xs text-muted-foreground">Connect WhatsApp first to pull templates from Meta.</p>
              )}
            </CardContent>
          </Card>

          {tenantId && <WhatsappMenuBotPanel tenantId={tenantId} workspaceId={workspaceId} compact />}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Add contact
              </CardTitle>
              <CardDescription>
                Save a customer number in Mako before outbound messaging (especially outside the 24h window).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="wa-contact-phone">Phone (E.164)</Label>
                  <Input
                    id="wa-contact-phone"
                    placeholder="+15551234567"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wa-contact-name">Name (optional)</Label>
                  <Input
                    id="wa-contact-name"
                    placeholder="Jane Doe"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                  />
                </div>
              </div>
              <Button
                size="sm"
                disabled={!contactPhone.trim() || addingContact}
                onClick={() => void addContact()}
              >
                {addingContact ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Phone className="h-4 w-4 mr-1.5" />}
                Add contact
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Why connect works but messages don&apos;t</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex gap-2">
                {connected ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <p>
                  <strong>OAuth connected</strong> — Meta token and phone number ID are stored. This alone does not
                  deliver or receive messages.
                </p>
              </div>
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Receiving</strong> — Requires the webhook URL above in Meta, subscribed to{' '}
                  <code className="text-xs">messages</code>. In dev/sandbox, add test numbers to Meta&apos;s allow list.
                </p>
              </div>
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Sending replies</strong> — Free-form text only works within 24 hours after the customer
                  messages you. Otherwise use an approved template (Social Inbox → WhatsApp tab, or WhatsApp templates).
                </p>
              </div>
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Inbox empty in Mako</strong> — Inbound messages were previously saved without a workspace ID;
                  new messages are fixed. Re-sync by having the customer message again after webhook is configured.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/replies">
                    <MessageSquareReply className="h-4 w-4 mr-1.5" />
                    Open Social Inbox
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/whatsapp/templates">
                    <LayoutTemplate className="h-4 w-4 mr-1.5" />
                    Message templates
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
