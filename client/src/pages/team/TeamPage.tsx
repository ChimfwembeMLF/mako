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
import { Users, Mail, UserCog, Trash2, Copy, RotateCw, Layers } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { WorkspaceAccessPicker } from '@/components/team/WorkspaceAccessPicker';
import { describeWorkspaceAccess } from '@/lib/workspaceAccess';

interface Member {
  id: string;
  userId: string | null;
  isActive: boolean;
  roleId: string | null;
  /** null means every workspace. */
  workspaceIds?: string[] | null;
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
  const [inviteWorkspaces, setInviteWorkspaces] = useState<string[] | null>(null);
  const { workspaces, activeWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [editingAccess, setEditingAccess] = useState<{ id: string; value: string[] | null } | null>(null);
  const [savingAccess, setSavingAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  /** Shown when an invite email could not be sent, so the link can be passed on by hand. */
  const [shareLink, setShareLink] = useState<{ email: string; link: string; problem?: string } | null>(null);

  useEffect(() => { if (tenant) load(); }, [tenant]);

  // New invites start with just the workspace you're in; "All workspaces" is a deliberate choice.
  const [inviteAccessTouched, setInviteAccessTouched] = useState(false);
  useEffect(() => {
    if (!inviteAccessTouched && activeWorkspace) setInviteWorkspaces([activeWorkspace]);
  }, [activeWorkspace, inviteAccessTouched]);

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

  /** Sends (or re-sends) an invite and reports honestly whether the email went out. */
  async function sendInvite(email: string, roleId: string, workspaceIds?: string[] | null): Promise<boolean> {
    if (!tenant) return false;
    const res = await tenantMembersApi.invite({ email, tenantId: tenant.id, roleId, workspaceIds: workspaceIds ?? undefined });
    await logAudit({ tenantId: tenant.id, action: 'team.invite', metadata: { email } });
    if (res.emailSent === false && res.acceptLink) {
      setShareLink({ email, link: res.acceptLink, problem: res.emailProblem });
      toast({ title: 'Invitation saved, email not sent', description: res.emailProblem ?? 'Copy the invite link below and send it to them.', variant: 'destructive' });
    } else {
      setShareLink(null);
      toast({
        title: 'Invitation sent',
        description: res.emailVia === 'gmail' ? `Sent to ${email} from your Gmail.` : res?.message ?? `${email} will join once they accept the invitation from their email.`,
      });
    }
    return true;
  }

  async function handleInvite() {
    if (!inviteEmail.trim() || !inviteRole || !tenant) return;
    setInviting(true);
    try {
      await sendInvite(inviteEmail.trim(), inviteRole, inviteWorkspaces);
      setInviteEmail('');
      setInviteRole('');
      setInviteWorkspaces(activeWorkspace ? [activeWorkspace] : myLimit);
      setInviteAccessTouched(false);
      load();
    } catch (err: unknown) {
      toast({ title: 'Invite failed', description: err instanceof Error ? err.message : 'Invite failed', variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  }

  async function resendInvite(member: Member) {
    const email = member.profile?.email;
    if (!email || !member.roleId) return;
    setResendingId(member.id);
    try {
      await sendInvite(email, member.roleId, member.workspaceIds);
      load();
    } catch (err: unknown) {
      toast({ title: 'Resend failed', description: err instanceof Error ? err.message : 'Resend failed', variant: 'destructive' });
    } finally {
      setResendingId(null);
    }
  }

  async function copyShareLink() {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink.link);
      toast({ title: 'Invite link copied' });
    } catch {
      toast({ title: 'Could not copy', description: 'Select the link and copy it manually.', variant: 'destructive' });
    }
  }

  async function saveAccess() {
    if (!tenant || !editingAccess) return;
    setSavingAccess(true);
    try {
      await tenantMembersApi.update(editingAccess.id, { workspaceIds: editingAccess.value });
      await logAudit({ tenantId: tenant.id, action: 'team.workspaces_changed', metadata: { member_id: editingAccess.id, workspace_ids: editingAccess.value } });
      toast({ title: 'Workspace access updated' });
      setEditingAccess(null);
      load();
    } catch (err: unknown) {
      toast({ title: 'Could not update access', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setSavingAccess(false);
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

  // If you're limited to some workspaces, you can only hand out those.
  const myLimit = members.find((m) => m.userId && m.userId === user?.id)?.workspaceIds ?? null;
  const workspaceOptions = workspaces.map((w) => ({ id: w.id, name: w.name, logoUrl: w.logoUrl }));

  const roleName = (roleId: string | null) => roles.find((r) => r.id === roleId)?.name ?? 'Unknown';

  return (
    <PermissionGate require={P.team.view} fallback={true}>
      <div className="w-full space-y-5 sm:space-y-6 pb-8 sm:pb-10 min-w-0">
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
            description="The invitation is emailed from your connected Gmail. If they don't have an account yet, they can register with the same email to join."
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
            <Field label="Which workspaces can they use?">
              <WorkspaceAccessPicker
                workspaces={workspaceOptions}
                value={inviteWorkspaces}
                onChange={(v) => {
                  setInviteAccessTouched(true);
                  setInviteWorkspaces(v);
                }}
                allowAll={!myLimit}
                defaultSelection={activeWorkspace ? [activeWorkspace] : undefined}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {myLimit
                  ? 'You can only give access to workspaces you use yourself.'
                  : 'Their role applies in every workspace they can use. You can change this later.'}
              </p>
            </Field>
            <FormActions className="justify-start sm:justify-end">
              <Button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail || !inviteRole || (inviteWorkspaces !== null && inviteWorkspaces.length === 0)}
                className="gap-1.5 h-10 rounded-lg"
              >
                <Mail className="h-4 w-4" /> {inviting ? 'Sending…' : 'Send invite'}
              </Button>
            </FormActions>
            {shareLink && (
              <div className="mt-4 rounded-lg border border-amber-300/70 bg-amber-50 p-4 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
                <p className="font-medium text-amber-900 dark:text-amber-200">The email to {shareLink.email} wasn't sent</p>
                {shareLink.problem && (
                  <p className="mt-1 text-xs text-amber-900 dark:text-amber-200">
                    {shareLink.problem}{' '}
                    {/Email page/.test(shareLink.problem) && (
                      <Link to="/mail" className="font-medium underline underline-offset-2">Open Email</Link>
                    )}
                  </p>
                )}
                <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">
                  The invitation is saved. Send them this link yourself; it only works when they sign in or register with {shareLink.email}. It expires in 7 days.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    readOnly
                    value={shareLink.link}
                    onFocus={(e) => e.currentTarget.select()}
                    className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
                    aria-label="Invite link"
                  />
                  <div className="flex gap-2">
                    <Button type="button" size="sm" className="h-9 gap-1.5" onClick={() => void copyShareLink()}>
                      <Copy className="h-3.5 w-3.5" /> Copy link
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-9" onClick={() => setShareLink(null)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            )}
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
                    {member.status === 'pending' ? 'Invitation not accepted yet' : member.profile?.email}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Layers className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {member.userId && member.userId === tenant?.owner_id
                          ? 'All workspaces · owner'
                          : describeWorkspaceAccess(member.workspaceIds, workspaceOptions)}
                      </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {member.status === 'pending' && can(P.team.invite) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 gap-1.5 rounded-lg text-xs"
                    onClick={() => void resendInvite(member)}
                    disabled={resendingId === member.id}
                  >
                    <RotateCw className={resendingId === member.id ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
                    {resendingId === member.id ? 'Sending…' : 'Resend'}
                  </Button>
                )}
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
                {member.status !== 'pending' && can(P.team.assignRoles) && member.userId && member.userId !== tenant?.owner_id && member.userId !== user?.id && (
                  <Popover
                    open={editingAccess?.id === member.id}
                    onOpenChange={(open) => setEditingAccess(open ? { id: member.id, value: member.workspaceIds ?? null } : null)}
                  >
                    <PopoverTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-9 w-9 rounded-lg" aria-label={`Workspaces for ${member.profile?.fullName ?? member.profile?.email ?? 'member'}`}>
                        <Layers className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 space-y-3">
                      <div>
                        <p className="text-sm font-semibold">Workspace access</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Which workspaces {member.profile?.fullName ?? 'they'} can see and work in.</p>
                      </div>
                      {editingAccess?.id === member.id && (
                        <WorkspaceAccessPicker
                          workspaces={workspaceOptions}
                          value={editingAccess.value}
                          onChange={(value) => setEditingAccess({ id: member.id, value })}
                          allowAll={!myLimit}
                          defaultSelection={activeWorkspace ? [activeWorkspace] : undefined}
                          disabled={savingAccess}
                        />
                      )}
                      <div className="flex justify-end gap-2 pt-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditingAccess(null)} disabled={savingAccess}>Cancel</Button>
                        <Button
                          size="sm"
                          onClick={() => void saveAccess()}
                          disabled={savingAccess || (editingAccess?.value !== null && !editingAccess?.value?.length)}
                        >
                          {savingAccess ? 'Saving…' : 'Save'}
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
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
