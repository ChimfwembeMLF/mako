import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import {
  Trash2, Mail, Search, Facebook, CheckCircle2, Clock, AlertCircle, ExternalLink,
} from 'lucide-react';
import { LegalCallout, LegalLayout, LegalSection } from './LegalLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { legalApi } from '@/lib/api';
import { cn } from '@/lib/utils';

function StatusBadge({ status }: { status: string }) {
  const completed = status === 'completed';
  const pending = status === 'pending';
  return (
    <Badge
      variant="outline"
      className={cn(
        'capitalize gap-1.5 px-2.5 py-0.5',
        completed && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        pending && 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
        !completed && !pending && 'border-destructive/30 bg-destructive/10 text-destructive',
      )}
    >
      {completed ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {status}
    </Badge>
  );
}

export default function DataDeletionPage() {
  const [searchParams] = useSearchParams();
  const codeFromUrl = searchParams.get('code') ?? '';
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [statusCode, setStatusCode] = useState(codeFromUrl);
  const [status, setStatus] = useState<Awaited<ReturnType<typeof legalApi.deletionStatus>> | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestDeletion() {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const body = await legalApi.requestDataDeletion(email.trim());
      setStatusCode(body.confirmationCode);
      setStatus({
        id: body.id,
        confirmationCode: body.confirmationCode,
        status: body.status,
        platform: 'email',
        email: email.trim().toLowerCase(),
        completedAt: null,
        createdAt: body.createdAt,
      });
      toast({
        title: 'Deletion request saved',
        description: `Confirmation code: ${body.confirmationCode}`,
      });
    } catch (err: unknown) {
      toast({
        title: 'Request failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function checkStatus() {
    if (!statusCode.trim()) return;
    setLoading(true);
    try {
      const body = await legalApi.deletionStatus(statusCode.trim());
      setStatus(body);
    } catch (err: unknown) {
      toast({
        title: 'Status check failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <LegalLayout
      title="Data Deletion"
      description="Request removal of your Mako account and connected social data, or track an existing deletion with your confirmation code."
      icon={Trash2}
    >
      <LegalCallout variant="accent">
        Deletion requests are processed according to platform requirements. Keep your confirmation code —
        you will need it to check progress.
      </LegalCallout>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-muted/20 p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold font-display">Request by email</h3>
              <p className="text-xs text-muted-foreground">We will queue deletion for the account tied to this email.</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="del-email">Account email</Label>
              <Input
                id="del-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="bg-background"
              />
            </div>
            <Button
              type="button"
              className="w-full gradient-primary border-0 text-primary-foreground"
              onClick={requestDeletion}
              disabled={loading || !email.trim()}
            >
              Request deletion
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-muted/20 p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold font-display">Check status</h3>
              <p className="text-xs text-muted-foreground">Use the code from your email or Meta callback URL.</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="del-code">Confirmation code</Label>
              <Input
                id="del-code"
                value={statusCode}
                onChange={(e) => setStatusCode(e.target.value)}
                placeholder="From Meta or email request"
                className="bg-background font-mono text-sm"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={checkStatus}
              disabled={loading || !statusCode.trim()}
            >
              Check status
            </Button>
          </div>
        </div>
      </div>

      {status && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold font-display flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Deletion request
            </h3>
            <StatusBadge status={status.status} />
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">Confirmation code</dt>
              <dd className="font-mono text-xs break-all text-foreground">{status.confirmationCode}</dd>
            </div>
            {status.email && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">Email</dt>
                <dd className="text-foreground">{status.email}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">Requested</dt>
              <dd className="text-foreground">{new Date(status.createdAt).toLocaleString()}</dd>
            </div>
            {status.completedAt && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">Completed</dt>
                <dd className="text-foreground">{new Date(status.completedAt).toLocaleString()}</dd>
              </div>
            )}
          </dl>
          {status.status !== 'completed' && (
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Processing may take up to 30 days depending on connected platforms. You can return here anytime to check progress.
            </p>
          )}
        </div>
      )}

      <LegalSection icon={Facebook} title="Meta (Facebook / Instagram)">
        <p>
          You can also remove Mako from your Facebook account: open{' '}
          <strong className="text-foreground font-medium">Settings → Apps and Websites</strong>, find Mako,
          and remove access. Meta may redirect you here with a confirmation code in the URL.
        </p>
        <LegalCallout>
          <span className="flex items-start gap-2">
            <ExternalLink className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
            <span>
              Our registered Meta Data Deletion Callback handles removal requests initiated from Facebook.
              If you arrived with a <code className="text-xs bg-muted px-1 py-0.5 rounded">?code=</code> parameter,
              enter it above to track status.
            </span>
          </span>
        </LegalCallout>
      </LegalSection>

      <p className="text-sm text-muted-foreground text-center pt-2">
        Questions? Review our{' '}
        <Link to="/privacy" className="text-primary font-medium hover:underline">Privacy Policy</Link>
        {' '}or contact support through your account settings.
      </p>
    </LegalLayout>
  );
}
