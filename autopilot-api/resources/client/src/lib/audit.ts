import { auditLogsApi, approvalRequestsApi } from '@/lib/api';
import { getAuthToken } from '@/lib/api';

interface AuditParams {
  tenantId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export async function logAudit(params: AuditParams): Promise<void> {
  if (!getAuthToken()) return;
  try {
    await auditLogsApi.create({
      tenantId: params.tenantId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      metadata: {
        ...params.metadata,
        before: params.before,
        after: params.after,
      },
    });
  } catch (err) {
    console.warn('[audit] Failed to log event:', params.action, err);
  }
}

export async function submitForApproval(params: {
  tenantId: string;
  actionKey: string;
  resourceType: string;
  resourceId?: string;
  payload: Record<string, unknown>;
  notes?: string;
  requestedBy: string;
}): Promise<string | null> {
  try {
    const res = await approvalRequestsApi.create({
      tenantId: params.tenantId,
      actionKey: params.actionKey,
      resourceType: params.resourceType,
      resourceId: params.resourceId ?? '00000000-0000-0000-0000-000000000000',
      requestedBy: params.requestedBy,
      payload: params.payload,
      requesterNotes: params.notes,
    });
    return res?.id ?? null;
  } catch (err) {
    console.warn('[approval] Failed to submit:', params.actionKey, err);
    return null;
  }
}
