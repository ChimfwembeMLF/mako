import React, { useEffect, useState } from 'react';
import { approvalRequestsApi, contentItemsApi } from '@/lib/api';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { PermissionGate } from '@/components/PermissionGate';
import { GitPullRequestArrow, CheckCircle2, XCircle, Clock, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ApprovalRequest {
  id: string; action_key: string; resource_type: string; resource_id: string | null;
  payload: Record<string, unknown> | null; status: string; requester_notes: string | null;
  reviewer_notes: string | null; created_at: string; reviewed_at: string | null;
  requested_by: string;
  profiles?: { full_name: string | null; email: string | null };
  maker_checker_config?: { label: string };
}

const STATUS_BADGE: Record<string, JSX.Element> = {
  pending:  <Badge variant="outline"  className="gap-1"><Clock className="h-3 w-3"/>Pending</Badge>,
  approved: <Badge variant="default"  className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3"/>Approved</Badge>,
  rejected: <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3"/>Rejected</Badge>,
};

export default function ApprovalsPage() {
  const { tenant }   = useTenant();
  const { user }     = useAuth();
  const { can }      = usePermissions();
  const { toast }    = useToast();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [notes, setNotes]       = useState<Record<string, string>>({});
  const [acting, setActing]     = useState<string | null>(null);
  const [tab, setTab]           = useState<'pending' | 'history'>('pending');

  useEffect(() => { if (tenant) load(); }, [tenant, tab]);

  async function load() {
    if (!tenant) return;
    const data = tab === 'pending'
      ? await approvalRequestsApi.findAll({ tenantId: tenant.id, status: 'pending' })
      : await approvalRequestsApi.findAll({ tenantId: tenant.id, statuses: ['approved', 'rejected'] });
    setRequests((data as ApprovalRequest[]) ?? []);
  }

  async function decide(req: ApprovalRequest, decision: 'approved' | 'rejected') {
    if (!can(P.approvals.review) || !tenant) return;
    setActing(req.id);
    try {
      await approvalRequestsApi.update(req.id, {
        status: decision,
        reviewerNotes: notes[req.id] ?? null,
        reviewedAt: new Date().toISOString(),
        reviewedBy: user?.id,
      } as any);

      if (decision === 'approved') await executeApprovedAction(req);

      await logAudit({ tenantId: tenant.id, action: `approval.${decision}`,
        resourceType: req.resource_type, resourceId: req.resource_id ?? undefined,
        metadata: { action_key: req.action_key } });

      toast({ title: decision === 'approved' ? 'Request approved' : 'Request rejected' });
      setRequests(prev => prev.filter(r => r.id !== req.id));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setActing(null);
    }
  }

  async function executeApprovedAction(req: ApprovalRequest) {
    switch (req.action_key) {
      case 'content.publish':
      case 'content.approve':
        if (req.resource_id) {
          await contentItemsApi.update(req.resource_id, { status: 'approved' });
        }
        break;
      default:
        break;
    }
  }

  const pending  = requests.filter(r => r.status === 'pending');
  const history  = requests.filter(r => r.status !== 'pending');

  return (
    <PermissionGate require={P.approvals.view} fallback={true}>
      <div className="max-w-3xl mx-auto space-y-5 sm:space-y-6 pb-8 min-w-0">
        <div className="flex items-center gap-3">
          <GitPullRequestArrow className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Approval Queue</h1>
            <p className="text-sm text-muted-foreground">
              Review actions submitted for maker-checker approval.
            </p>
          </div>
          {pending.length > 0 && (
            <Badge variant="destructive" className="ml-auto">{pending.length} pending</Badge>
          )}
        </div>

        <Tabs value={tab} onValueChange={v => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="pending">Pending {pending.length > 0 && `(${pending.length})`}</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-3 mt-4">
            {pending.length === 0 && (
              <div className="text-center py-16 text-muted-foreground text-sm">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                No pending approvals. All caught up!
              </div>
            )}
            {pending.map(req => (
              <RequestCard key={req.id} req={req} canReview={can(P.approvals.review)}
                notes={notes[req.id] ?? ''} onNote={v => setNotes(p => ({ ...p, [req.id]: v }))}
                onApprove={() => decide(req, 'approved')} onReject={() => decide(req, 'rejected')}
                acting={acting === req.id} />
            ))}
          </TabsContent>

          <TabsContent value="history" className="space-y-3 mt-4">
            {history.map(req => <RequestCard key={req.id} req={req} canReview={false} readonly />)}
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGate>
  );
}

function RequestCard({ req, canReview, notes = '', onNote, onApprove, onReject, acting, readonly }: {
  req: ApprovalRequest; canReview: boolean; notes?: string;
  onNote?: (v: string) => void; onApprove?: () => void; onReject?: () => void;
  acting?: boolean; readonly?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">{req.maker_checker_config?.label ?? req.action_key}</p>
            {STATUS_BADGE[req.status]}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{req.resource_type} • {req.resource_id?.slice(0, 8)}</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div className="flex items-center gap-1 justify-end">
            <User className="h-3 w-3" />
            {(req as any).profiles?.full_name ?? (req as any).profiles?.email ?? 'Unknown'}
          </div>
          <p>{formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}</p>
        </div>
      </div>

      {req.requester_notes && (
        <p className="text-xs bg-muted px-3 py-2 rounded-md">"{req.requester_notes}"</p>
      )}
      {req.payload && (
        <pre className="text-[10px] bg-muted/50 rounded p-2 overflow-auto max-h-24">
          {JSON.stringify(req.payload, null, 2)}
        </pre>
      )}

      {!readonly && canReview && (
        <div className="space-y-2 pt-1">
          <Textarea placeholder="Reviewer notes (optional)…" rows={2} value={notes}
            onChange={e => onNote?.(e.target.value)} className="text-xs resize-none" />
          <div className="flex gap-2">
            <Button size="sm" onClick={onApprove} disabled={acting} className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
            </Button>
            <Button size="sm" variant="destructive" onClick={onReject} disabled={acting} className="gap-1">
              <XCircle className="h-3.5 w-3.5" /> Reject
            </Button>
          </div>
        </div>
      )}
      {req.reviewer_notes && (
        <p className="text-xs text-muted-foreground border-t pt-2">Reviewer: "{req.reviewer_notes}"</p>
      )}
    </div>
  );
}
