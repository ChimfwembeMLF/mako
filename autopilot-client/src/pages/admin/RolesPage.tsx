import React, { useEffect, useState } from 'react';
import { rolesApi, permissionsApi, rolePermissionsApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { useTenant } from '@/hooks/useTenant';
import { P } from '@/lib/permissions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FormSection, FormInput } from '@/components/forms';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, Plus, Trash2 } from 'lucide-react';
import { PermissionGate } from '@/components/PermissionGate';

interface Role { id: string; name: string; description?: string | null; isSystem?: boolean; tenantId: string }
interface Permission { key: string; label: string; module?: string; description?: string | null }
interface RolePerm { roleId: string; permissionKey: string }

const MODULES = ['content', 'leads', 'media', 'templates', 'replies', 'analytics', 'team', 'settings', 'approvals', 'audit', 'admin'];

export default function RolesPage() {
  const { isSuperAdmin } = usePermissions();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [rolePerms, setRolePerms] = useState<RolePerm[]>([]);
  const [selected, setSelected] = useState<Role | null>(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (tenant) load(); }, [tenant]);

  async function load() {
    if (!tenant) return;
    const [r, p, rp] = await Promise.all([
      rolesApi.findAll(tenant.id),
      permissionsApi.findAll(),
      rolePermissionsApi.findAll(),
    ]);
    setRoles(Array.isArray(r) ? r : []);
    setPerms(Array.isArray(p) ? p : []);
    const tenantRoleIds = new Set((Array.isArray(r) ? r : []).map((x: Role) => x.id));
    setRolePerms(Array.isArray(rp) ? rp.filter((x: RolePerm) => tenantRoleIds.has(x.roleId)) : []);
    setSelected((prev) => (prev ? (r as Role[]).find((x) => x.id === prev.id) ?? null : null));
  }

  function hasPermission(roleId: string, key: string) {
    return rolePerms.some((rp) => rp.roleId === roleId && rp.permissionKey === key);
  }

  async function togglePerm(roleId: string, key: string, has: boolean) {
    if (!isSuperAdmin && selected?.isSystem) return;
    try {
      if (has) {
        await rolePermissionsApi.remove(roleId, key);
      } else {
        await rolePermissionsApi.create({ roleId, permissionKey: key });
      }
      setRolePerms((prev) =>
        has
          ? prev.filter((rp) => !(rp.roleId === roleId && rp.permissionKey === key))
          : [...prev, { roleId, permissionKey: key }],
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update permission';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  }

  async function createRole() {
    if (!newName.trim() || !tenant) return;
    setSaving(true);
    try {
      const data = await rolesApi.create({
        tenantId: tenant.id,
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        isSystem: false,
      });
      toast({ title: 'Role created' });
      setNewName('');
      setNewDesc('');
      setRoles((prev) => [...prev, data]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create role';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function deleteRole(role: Role) {
    if (role.isSystem) return;
    try {
      await rolesApi.remove(role.id);
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
      if (selected?.id === role.id) setSelected(null);
      toast({ title: 'Role deleted' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete role';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  }

  const grouped = MODULES.reduce<Record<string, Permission[]>>((acc, m) => {
    acc[m] = perms.filter((p) => p.module === m);
    return acc;
  }, {});

  return (
    <PermissionGate requireAny={[P.admin.roles, P.team.assignRoles]} fallback={true}>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Roles & Permissions</h1>
            <p className="text-sm text-muted-foreground">Manage roles and permission assignments for {tenant?.name}.</p>
          </div>
        </div>

        <div className="grid grid-cols-[280px_1fr] gap-6">
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Roles</p>
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => setSelected(role)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors
                  ${selected?.id === role.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-muted border-border'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{role.name}</span>
                  <div className="flex items-center gap-1">
                    {role.isSystem && <Badge variant="secondary" className="text-[10px]">System</Badge>}
                    {!role.isSystem && (
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); deleteRole(role); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </button>
            ))}

            <FormSection title="New custom role" className="mt-4 !p-0 border-0 shadow-none bg-transparent">
              <div className="rounded-xl border bg-card p-3 space-y-3">
                <Field label="Role name">
                  <FormInput placeholder="Role name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                </Field>
                <Field label="Description" hint="Optional">
                  <FormInput placeholder="Description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
                </Field>
                <Button size="sm" className="w-full gap-1 h-9 rounded-lg" onClick={createRole} disabled={saving}>
                  <Plus className="h-3 w-3" /> Create
                </Button>
              </div>
            </FormSection>
          </div>

          <div className="border rounded-lg p-5">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Select a role to manage its permissions.</p>
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="font-semibold">{selected.name}</h2>
                  {selected.description && <p className="text-sm text-muted-foreground">{selected.description}</p>}
                </div>
                {MODULES.map((mod) =>
                  grouped[mod]?.length ? (
                    <div key={mod}>
                      <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">{mod}</p>
                      <div className="space-y-2">
                        {grouped[mod].map((perm) => {
                          const has = hasPermission(selected.id, perm.key);
                          return (
                            <div key={perm.key} className="flex items-center justify-between py-1">
                              <div>
                                <p className="text-sm font-medium">{perm.label}</p>
                                <p className="text-xs text-muted-foreground">{perm.key}</p>
                              </div>
                              <Switch
                                checked={has}
                                disabled={selected.isSystem && !isSuperAdmin}
                                onCheckedChange={(v) => togglePerm(selected.id, perm.key, !v)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </PermissionGate>
  );
}
