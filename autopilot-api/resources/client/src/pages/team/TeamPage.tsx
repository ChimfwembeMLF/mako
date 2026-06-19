import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tenantMembersApi, rolesApi } from '@/lib/api';
import { useTenant } from '@/hooks/useTenant';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PermissionGate } from '@/components/PermissionGate';
import { Field, FormSection, FormRow, FormActions, FormInput, formSelectProps } from '@/components/forms';
import { Users, Mail, UserCog, Trash2 } from 'lucide-react';

interface Member {
  id: string;
  userId: string | null;
  isActive: boolean;
  roleId: string | null;
  joinedAt: string;
  status?: 'active' | 'pending';
  profile: { fullName: string | null; email: string | null; avatarUrl: string | null } | null;
}

interface Role { id: string; name: string; isSystem?: boolean }

export default function TeamPage() {
  const { tenant } = useTenant();
  const { can } = usePermissions();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);

  useEffect(() => { if (tenant) load(); }, [tenant]);

  async function load() {
    if (!tenant) return;
    setLoading(true);
    try {
      const [memberData, roleData] = await Promise.all([
        tenantMembersApi.findAll(tenant.id, true),
        rolesApi.findAll(tenant.id),
      ]);
      setMembers(Array.isArray(memberData) ? memberData : []);
      setRoles(Array.isArray(roleData) ? roleData : []);
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to load team', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim() || !inviteRole || !tenant) return;
    setInviting(true);
    try {
      const res = await tenantMembersApi.invite({ email: inviteEmail, tenantId: tenant.id, roleId: inviteRole });
      await logAudit({ tenantId: tenant.id, action: 'team.invite', metadata: { email: inviteEmail } });
      if (res?.pending) {
        toast({
          title: 'Invitation sent',
          description: `${inviteEmail} will join when they register or sign in with that email.`,
        });
      } else {
        toast({ title: 'Member added', description: `${inviteEmail} was added to the team.` });
      }
      setInviteEmail('');
      setInviteRole('');
      load();
    } catch (err: unknown) {
      toast({ title: 'Invite failed', description: err instanceof Error ? err.message : 'Invite failed', variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(memberId: string, roleId: string) {
    if (!tenant) return;
    await tenantMembersApi.update(memberId, { roleId });
    await logAudit({ tenantId: tenant.id, action: 'team.role_changed', metadata: { member_id: memberId, role_id: roleId } });
    load();
    toast({ title: 'Role updated' });
  }

  async function removeMember(member: Member) {
    if (!tenant) return;
    if (member.status === 'pending') {
      await tenantMembersApi.revokeInvitation(member.id, tenant.id);
      await logAudit({ tenantId: tenant.id, action: 'team.invite_revoked', metadata: { email: member.profile?.email } });
      load();
      toast({ title: 'Invitation cancelled' });
      return;
    }
    await tenantMembersApi.update(member.id, { isActive: false });
    await logAudit({ tenantId: tenant.id, action: 'team.member_removed', metadata: { user_id: member.userId } });
    load();
    toast({ title: 'Member removed' });
  }

  const roleName = (roleId: string | null) => roles.find((r) => r.id === roleId)?.name ?? 'Unknown';

  return (
    <PermissionGate require={P.team.view} fallback={true}>
      <div className="max-w-4xl mx-auto space-y-5 sm:space-y-6 pb-8 sm:pb-10 min-w-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold font-display">Team</h1>
            <p className="text-sm text-muted-foreground">Manage who has access to {tenant?.name}.</p>
          </div>
        </div>

        <PermissionGate require={P.team.invite}>
          <FormSection
            title="Invite member"
            description="They'll receive an email invite. If they don't have an account yet, they can register with the same email to join."
          >
            <FormRow cols={1}>
              <Field label="Email" htmlFor="invite-email" required>
                <FormInput
                  id="invite-email"
                  type="email"
                  icon={Mail}
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </Field>
              <Field label="Role" required>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger {...formSelectProps()}><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </FormRow>
            <FormActions className="justify-start sm:justify-end">
              <Button onClick={handleInvite} disabled={inviting || !inviteEmail || !inviteRole} className="gap-1.5 h-10 rounded-lg">
                <Mail className="h-4 w-4" /> {inviting ? 'Sending…' : 'Send invite'}
              </Button>
            </FormActions>
          </FormSection>
        </PermissionGate>

        <div className="rounded-xl border border-border/50 bg-card shadow-sm divide-y overflow-hidden">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading team…</p>
          ) : members.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No team members yet.</p>
          ) : members.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-4 gap-4 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  {(member.profile?.fullName ?? member.profile?.email ?? '?')[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">
                      {member.status === 'pending'
                        ? member.profile?.email
                        : (member.profile?.fullName ?? 'Unnamed')}
                    </p>
                    {member.status === 'pending' && (
                      <Badge variant="outline" className="text-[10px] shrink-0">Invited</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {member.status === 'pending' ? 'Awaiting signup' : member.profile?.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {member.status === 'pending' ? (
                  <Badge variant="secondary">{roleName(member.roleId)}</Badge>
                ) : can(P.team.assignRoles) ? (
                  <Select value={member.roleId ?? ''} onValueChange={(v) => changeRole(member.id, v)}>
                    <SelectTrigger {...formSelectProps('w-32 h-9 text-xs')}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="secondary">{roleName(member.roleId)}</Badge>
                )}
                {member.status !== 'pending' && can(P.team.assignPermissions) && member.userId && (
                  <Button size="icon" variant="ghost" className="h-9 w-9 rounded-lg" asChild>
                    <Link to={`/team/${member.userId}/permissions`}><UserCog className="h-4 w-4" /></Link>
                  </Button>
                )}
                {can(P.team.remove) && (
                  <Button size="icon" variant="ghost" className="h-9 w-9 rounded-lg text-destructive" onClick={() => removeMember(member)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PermissionGate>
  );
}
