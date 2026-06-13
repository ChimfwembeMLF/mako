import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LegalLayout } from './LegalLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { legalApi } from '@/lib/api';

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
        description: `Your request was recorded. Confirmation code: ${body.confirmationCode}`,
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
    <LegalLayout title="Data Deletion Instructions">
      <p>Request removal of your Tekrem Innovation Solutions - Mako account and connected social data.</p>

      <h2>Request by email</h2>
      <div className="not-prose space-y-3 max-w-md">
        <div className="space-y-1">
          <Label htmlFor="del-email">Account email</Label>
          <Input
            id="del-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </div>
        <Button type="button" onClick={requestDeletion} disabled={loading || !email.trim()}>
          Request deletion
        </Button>
      </div>

      <h2>Check status</h2>
      <div className="not-prose space-y-3 max-w-md">
        <div className="space-y-1">
          <Label htmlFor="del-code">Confirmation code</Label>
          <Input
            id="del-code"
            value={statusCode}
            onChange={(e) => setStatusCode(e.target.value)}
            placeholder="From Meta or email request"
          />
        </div>
        <Button type="button" variant="outline" onClick={checkStatus} disabled={loading || !statusCode.trim()}>
          Check status
        </Button>
        {status && (
          <div className="text-sm space-y-2 rounded-lg border bg-muted/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">Status</span>
              <Badge variant={status.status === 'completed' ? 'secondary' : 'destructive'}>
                {status.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground break-all">Code: {status.confirmationCode}</p>
            {status.email && <p className="text-xs">Email: {status.email}</p>}
            <p className="text-xs text-muted-foreground">
              Requested {new Date(status.createdAt).toLocaleString()}
              {status.completedAt ? ` · Completed ${new Date(status.completedAt).toLocaleString()}` : ''}
            </p>
          </div>
        )}
      </div>

      <h2>Meta (Facebook / Instagram)</h2>
      <p>
        Remove the app in Facebook Settings → Apps and Websites, or use our registered Meta Data Deletion Callback.
      </p>
    </LegalLayout>
  );
}
