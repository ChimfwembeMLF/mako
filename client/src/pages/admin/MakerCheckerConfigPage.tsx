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
      <div className="w-full space-y-5 sm:space-y-6 pb-8 min-w-0">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-primary/10 rounded-xl">
            <GitPullRequestArrow className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Maker-Checker Rules</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure which actions require approval before they take effect in {tenant?.name}.
            </p>
          </div>
        </div>

        {!canEdit && (
          <Alert className="bg-amber-50 text-amber-800 border-amber-200">
            <Info className="h-4 w-4" />
            <AlertDescription>You need the maker-checker admin permission to modify these rules.</AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {Object.entries(grouped).map(([mod, items]) => (
            <div key={mod} className="border rounded-xl overflow-hidden shadow-sm bg-card">
              <div className="px-4 py-3 bg-gradient-to-r from-primary/10 to-transparent border-b">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary/60"></span>
                  {mod}
                </h3>
              </div>
              <div className="divide-y">
                {items.map((cfg) => (
                  <div key={cfg.id} className="p-4 space-y-3 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm text-foreground">{cfg.label}</p>
                        <p className="text-xs font-mono text-muted-foreground mt-0.5">{cfg.actionKey}</p>
                      </div>
                      <Switch
                        checked={cfg.isEnabled}
                        disabled={!canEdit || saving === cfg.id}
                        onCheckedChange={(v) => update(cfg.id, { isEnabled: v })}
                      />
                    </div>
                    {cfg.description && <p className="text-sm text-muted-foreground">{cfg.description}</p>}
                    <div className="flex items-center gap-3 pt-2">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Approver role</Label>
                      <Select
                        value={cfg.approverRoleId}
                        disabled={!canEdit || saving === cfg.id}
                        onValueChange={(v) => update(cfg.id, { approverRoleId: v })}
                      >
                        <SelectTrigger className="w-48 h-8 text-xs font-medium bg-background border-input">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PermissionGate>
  );
}
