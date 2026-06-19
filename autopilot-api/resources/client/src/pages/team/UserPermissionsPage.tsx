import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  profilesApi, permissionsApi, userPermissionsApi, rbacApi, tenantMembersApi, rolesApi,
} from '@/lib/api';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { P } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { PermissionGate } from '@/components/PermissionGate';
import { ArrowLeft, UserCog, ShieldCheck, ShieldOff } from 'lucide-react';

interface Permission { key: string; label: string; module?: string; description?: string | null }
interface DirectPerm { permissionKey: string; effect: 'allow' | 'deny'; id?: string }

const MODULES = ['content', 'leads', 'media', 'templates', 'replies', 'analytics', 'team', 'settings', 'approvals', 'audit', 'admin'];

export default function UserPermissionsPage() {
  const { userId } = useParams<{ userId: string }>();
  const { tenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();

  const [allPerms, setAllPerms] = useState<Permission[]>([]);
  const [rolePerms, setRolePerms] = useState<Set<string>>(new Set());
  const [directPerms, setDirectPerms] = useState<DirectPerm[]>([]);
  const [profile, setProfile] = useState<{ fullName: string | null; email: string | null } | null>(null);
  const [roleName, setRoleName] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { if (tenant && userId) load(); }, [tenant, userId]);

  async function load() {
    if (!tenant || !userId) return;
    const [profiles, perms, overrides, effective, members, roles] = await Promise.all([
      profilesApi.findByUser(userId),
      permissionsApi.findAll(),
      userPermissionsApi.findAll(tenant.id, userId),
      rbacApi.getEffectivePermissions(tenant.id, userId),
      tenantMembersApi.findAll(tenant.id),
      rolesApi.findAll(tenant.id),
    ]);

    const p = Array.isArray(profiles) ? profiles[0] : null;
    setProfile(p ? { fullName: p.fullName ?? p.displayName, email: null } : null);

    const member = (Array.isArray(members) ? members : []).find(
      (m: { userId: string }) => m.userId === userId,
    );
    const role = (Array.isArray(roles) ? roles : []).find(
      (r: { id: string }) => r.id === member?.roleId,
    );
    setRoleName(role?.name ?? effective.roleName ?? null);

    setAllPerms(Array.isArray(perms) ? perms : []);
    setDirectPerms(
      (Array.isArray(overrides) ? overrides : []).map((o: DirectPerm) => ({
        id: (o as any).id,
        permissionKey: (o as any).permissionKey,
        effect: (o as any).effect,
      })),
    );

    const rolePermSet = new Set<string>(effective.permissions ?? []);
    for (const dp of Array.isArray(overrides) ? overrides : []) {
      if ((dp as any).effect === 'allow') rolePermSet.add((dp as any).permissionKey);
      if ((dp as any).effect === 'deny') rolePermSet.delete((dp as any).permissionKey);
    }
    setRolePerms(rolePermSet);
  }

  function getEffective(key: string): 'granted' | 'denied' | 'inherited' {
    const direct = directPerms.find((d) => d.permissionKey === key);
    if (direct) return direct.effect === 'allow' ? 'granted' : 'denied';
    return rolePerms.has(key) ? 'inherited' : 'denied';
  }

  async function setDirectOverride(key: string, grant: boolean | null) {
    if (!tenant || !userId || !user) return;
    setSaving(key);
    try {
      const existing = directPerms.find((d) => d.permissionKey === key);
      if (grant === null) {
        if (existing?.id) await userPermissionsApi.remove(existing.id);
        setDirectPerms((prev) => prev.filter((d) => d.permissionKey !== key));
      } else {
        if (existing?.id) {
          await userPermissionsApi.update(existing.id, { effect: grant ? 'allow' : 'deny' });
        } else {
          await userPermissionsApi.create({
            tenantId: tenant.id,
            userId,
            permissionKey: key,
            effect: grant ? 'allow' : 'deny',
            grantedBy: user.id,
          });
        }
        setDirectPerms((prev) => {
          const next = prev.filter((d) => d.permissionKey !== key);
          return [...next, { permissionKey: key, effect: grant ? 'allow' : 'deny' }];
        });
      }
      await logAudit({
        tenantId: tenant.id,
        action: 'team.permission_changed',
        metadata: { target_user: userId, permission: key, grant },
      });
      toast({ title: 'Permission updated' });
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Update failed';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  }

  const grouped = MODULES.reduce<Record<string, Permission[]>>((acc, m) => {
    acc[m] = allPerms.filter((p) => p.module === m);
    return acc;
  }, {});

  return (
    <PermissionGate require={P.team.assignPermissions} fallback={true}>
      <div className="max-w-3xl mx-auto space-y-5 sm:space-y-6 pb-8 min-w-0">
        <div className="flex items-center gap-3">
          <Link to="/team"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <UserCog className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Direct Permissions</h1>
            <p className="text-sm text-muted-foreground">
              {profile?.fullName ?? userId}
              {roleName && <span className="ml-1">· <Badge variant="outline" className="text-[10px]">{roleName}</Badge></span>}
            </p>
          </div>
        </div>

        {MODULES.map((module) => (
          <div key={module} className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground capitalize">{module}</p>
            <div className="rounded-lg border bg-card divide-y">
              {(grouped[module] ?? []).map((perm) => {
                const effective = getEffective(perm.key);
                const direct = directPerms.find((d) => d.permissionKey === perm.key);
                return (
                  <div key={perm.key} className="flex items-center justify-between px-4 py-3 gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{perm.label}</p>
                        {effective === 'inherited' && !direct && (
                          <Badge variant="secondary" className="text-[10px]">From role</Badge>
                        )}
                        {direct?.effect === 'allow' && (
                          <Badge variant="default" className="text-[10px] bg-green-600">Override: Grant</Badge>
                        )}
                        {direct?.effect === 'deny' && (
                          <Badge variant="destructive" className="text-[10px]">Override: Deny</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{perm.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {direct && (
                        <Button variant="ghost" size="sm" className="text-xs h-7 px-2"
                          onClick={() => setDirectOverride(perm.key, null)} disabled={saving === perm.key}>
                          Reset
                        </Button>
                      )}
                      <div className="flex items-center gap-1.5">
                        <ShieldOff className="h-3.5 w-3.5 text-muted-foreground" />
                        <Switch
                          checked={direct?.effect === 'allow' || (effective === 'inherited' && !direct)}
                          disabled={saving === perm.key}
                          onCheckedChange={(val) => setDirectOverride(perm.key, val)}
                        />
                        <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </PermissionGate>
  );
}
