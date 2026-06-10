import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LegalLayout } from './LegalLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/lib/api';

export default function DataDeletionPage() {
  const [searchParams] = useSearchParams();
  const codeFromUrl = searchParams.get('code') ?? '';
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [statusCode, setStatusCode] = useState(codeFromUrl);
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestDeletion() {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/legal/data-deletion-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? body.message ?? 'Request failed');
      setStatusCode(body.confirmationCode ?? '');
      toast({ title: 'Deletion requested', description: `Confirmation code: ${body.confirmationCode}` });
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
      const res = await fetch(
        `${API_BASE_URL}/api/v1/legal/deletion-status?code=${encodeURIComponent(statusCode.trim())}`,
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Not found');
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
      <p>Request removal of your Tekrem Innvation Solutions Autopilot account and connected social data.</p>

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
          <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto">{JSON.stringify(status, null, 2)}</pre>
        )}
      </div>

      <h2>Meta (Facebook / Instagram)</h2>
      <p>
        Remove the app in Facebook Settings → Apps and Websites, or use our registered Meta Data Deletion Callback.
      </p>
    </LegalLayout>
  );
}
