import React, { useEffect, useState } from 'react';
import { approvalWorkflowsApi, rolesApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { useTenant } from '@/hooks/useTenant';
import { P } from '@/lib/permissions';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PermissionGate } from '@/components/PermissionGate';
import { GitPullRequestArrow, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface McConfig {
  id: string;
  actionKey: string;
  label: string;
  description?: string | null;
  isEnabled: boolean;
  approverRoleId: string;
}

export default function MakerCheckerConfigPage() {
  const { can } = usePermissions();
  const canEdit = can(P.admin.makerChecker);
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<McConfig[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { if (tenant) load(); }, [tenant]);

  async function load() {
    if (!tenant) return;
    const [data, roleData] = await Promise.all([
      approvalWorkflowsApi.findAll(tenant.id),
      rolesApi.findAll(tenant.id),
    ]);
    setConfigs(Array.isArray(data) ? data : []);
    setRoles(Array.isArray(roleData) ? roleData : []);
  }

  async function update(id: string, patch: Partial<McConfig>) {
    setSaving(id);
    try {
      await approvalWorkflowsApi.update(id, patch);
      setConfigs((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      toast({ title: 'Saved' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  }

  const grouped = configs.reduce<Record<string, McConfig[]>>((acc, c) => {
    const mod = c.actionKey.split('.')[0];
    (acc[mod] ??= []).push(c);
    return acc;
  }, {});

  return (
    <PermissionGate require={P.admin.makerChecker} fallback={true}>
      <div className="max-w-3xl mx-auto space-y-5 sm:space-y-6 pb-8 min-w-0">
        <div className="flex items-center gap-3">
          <GitPullRequestArrow className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Maker-Checker Rules</h1>
            <p className="text-sm text-muted-foreground">
              Configure which actions require approval before they take effect in {tenant?.name}.
            </p>
          </div>
        </div>

        {!canEdit && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>You need the maker-checker admin permission to modify these rules.</AlertDescription>
          </Alert>
        )}

        {Object.entries(grouped).map(([mod, items]) => (
          <div key={mod} className="border rounded-lg divide-y">
            <p className="px-4 py-2 text-xs font-semibold uppercase text-muted-foreground bg-muted/30">{mod}</p>
            {items.map((cfg) => (
              <div key={cfg.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{cfg.label}</p>
                    <p className="text-xs text-muted-foreground">{cfg.actionKey}</p>
                  </div>
                  <Switch
                    checked={cfg.isEnabled}
                    disabled={!canEdit || saving === cfg.id}
                    onCheckedChange={(v) => update(cfg.id, { isEnabled: v })}
                  />
                </div>
                {cfg.description && <p className="text-xs text-muted-foreground">{cfg.description}</p>}
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Approver role</Label>
                  <Select
                    value={cfg.approverRoleId}
                    disabled={!canEdit || saving === cfg.id}
                    onValueChange={(v) => update(cfg.id, { approverRoleId: v })}
                  >
                    <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </PermissionGate>
  );
}
