import React from 'react';
import { format } from 'date-fns';
import { Download, ExternalLink, Loader2, Receipt } from 'lucide-react';
import { paymentsApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

interface BillingRecord {
  id: string;
  invoiceNumber: string;
  status: string | null;
  amount: string | null;
  currency: string | null;
  method: 'mobile_money';
  network: string | null;
  plan: string | null;
  createdAt: string;
  paidAt: string | null;
  canDownloadInvoice: boolean;
}

function statusVariant(status: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  const s = (status ?? '').toUpperCase();
  if (s === 'COMPLETED') return 'default';
  if (s === 'ACCEPTED') return 'secondary';
  if (s === 'FAILED') return 'destructive';
  return 'outline';
}

function statusLabel(status: string | null): string {
  const s = (status ?? '').toUpperCase();
  if (s === 'COMPLETED') return 'Paid';
  if (s === 'ACCEPTED') return 'Pending';
  if (s === 'FAILED') return 'Failed';
  return status ?? 'Unknown';
}

function networkLabel(network: string | null): string {
  if (!network) return 'Mobile Money';
  const map: Record<string, string> = {
    MTN_MOMO_ZMB: 'MTN MoMo',
    AIRTEL_OAPI_ZMB: 'Airtel Money',
    ZAMTEL_ZMB: 'Zamtel Kwacha',
  };
  return map[network] ?? network;
}

export function TenantBillingRecords({ tenantId }: { tenantId: string }) {
  const { toast } = useToast();
  const [records, setRecords] = React.useState<BillingRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    paymentsApi.listDeposits(tenantId)
      .then(setRecords)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load billing records.'))
      .finally(() => setLoading(false));
  }, [tenantId]);

  async function handleDownload(depositId: string, view = false) {
    setDownloadingId(depositId);
    try {
      await paymentsApi.downloadInvoice(tenantId, depositId, view);
      if (!view) {
        toast({ title: 'Invoice downloaded', description: 'Your PDF tax invoice has been saved.' });
      }
    } catch (e: unknown) {
      toast({
        title: 'Could not download invoice',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Receipt className="h-5 w-5 text-primary" />
          Billing history
        </CardTitle>
        <CardDescription>Payments and invoices for this workspace</CardDescription>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading billing records…
          </div>
        )}
        {!loading && error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}
        {!loading && !error && records.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            <Receipt className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No payments yet</p>
            <p className="text-sm mt-1">Upgrade your plan with mobile money — invoices appear here once paid.</p>
          </div>
        )}
        {!loading && !error && records.length > 0 && (
          <div className="overflow-x-auto -mx-6 sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {format(new Date(r.paidAt ?? r.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.invoiceNumber}</TableCell>
                    <TableCell className="capitalize">{r.plan ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(r.status)}>{statusLabel(r.status)}</Badge>
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      {r.amount ? `${r.currency ?? 'ZMW'} ${r.amount}` : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {networkLabel(r.network)}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.canDownloadInvoice ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={downloadingId === r.id}
                            onClick={() => handleDownload(r.id, true)}
                            title="View invoice"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={downloadingId === r.id}
                            onClick={() => handleDownload(r.id)}
                          >
                            {downloadingId === r.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <Download className="h-3.5 w-3.5 mr-1" />
                                Invoice
                              </>
                            )}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
