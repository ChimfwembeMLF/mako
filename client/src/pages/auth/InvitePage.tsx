import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, MailCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { tenantMembersApi, type InvitationPreview } from '@/lib/api';

/** Invite links outlive sign-in: kept here while the person signs in or registers. */
export const PENDING_INVITE_KEY = 'mako_pending_invite';
const ACTIVE_TENANT_KEY = 'brandpilot_active_tenant';

export function readPendingInvite(): { id: string; token: string } | null {
  try {
    const raw = localStorage.getItem(PENDING_INVITE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.id && parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

function clearPendingInvite() {
  try {
    localStorage.removeItem(PENDING_INVITE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export default function InvitePage() {
  const [params] = useSearchParams();
  const stored = readPendingInvite();
  const id = params.get('id') ?? stored?.id ?? '';
  const token = params.get('token') ?? stored?.token ?? '';

  const { user, loading: authLoading, signOut } = useAuth();
  const { refetch } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [invite, setInvite] = useState<InvitationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<'accept' | 'decline' | null>(null);

  // Remember the link before sending a signed-out visitor to sign in.
  useEffect(() => {
    if (!id || !token || authLoading || user) return;
    try {
      localStorage.setItem(PENDING_INVITE_KEY, JSON.stringify({ id, token }));
    } catch {
      /* storage unavailable: they can reopen the email link after signing in */
    }
  }, [id, token, user, authLoading]);

  const load = useCallback(async () => {
    if (!user || !id || !token) return;
    setLoading(true);
    setError(null);
    try {
      setInvite(await tenantMembersApi.previewInvitation(id, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [user, id, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function accept() {
    setActing('accept');
    try {
      const { tenantId } = await tenantMembersApi.acceptInvitation(id, token);
      clearPendingInvite();
      try {
        localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
      } catch {
        /* storage unavailable */
      }
      await refetch();
      toast({ title: `You joined ${invite?.tenantName ?? 'the workspace'}` });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast({
        title: 'Could not accept the invitation',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setActing(null);
    }
  }

  async function decline() {
    setActing('decline');
    try {
      await tenantMembersApi.declineInvitation(id, token);
      clearPendingInvite();
      toast({ title: 'Invitation declined' });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast({
        title: 'Could not decline the invitation',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setActing(null);
    }
  }

  async function switchAccount() {
    await signOut();
    navigate('/auth', { replace: true });
  }

  const shell = (title: React.ReactNode, subtitle: React.ReactNode, children?: React.ReactNode) => (
    <AuthLayout title={title} subtitle={subtitle}>
      {children}
    </AuthLayout>
  );
  const wideButton = 'h-12 w-full rounded-full text-base font-semibold';

  if (!id || !token) {
    return shell(
      'This invitation link is incomplete',
      'Part of the link is missing. Open it again from your invitation email.',
      <Button asChild variant="outline" className={wideButton}>
        <Link to="/">Go to Mako</Link>
      </Button>,
    );
  }

  if (authLoading || (user && loading && !invite && !error)) {
    return shell(
      'Opening your invitation…',
      undefined,
      <div className="flex justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>,
    );
  }

  if (!user) {
    return shell(
      "You've been invited to Mako",
      'Sign in, or create an account, with the email address the invitation was sent to. You will come straight back here to accept it.',
      <>
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-border/70 bg-card p-4 text-sm">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-muted-foreground">Your invitation is saved on this device while you sign in.</p>
        </div>
        <Button asChild className={wideButton}>
          <Link to="/auth">Sign in</Link>
        </Button>
        <Button asChild variant="outline" className={`${wideButton} mt-3`}>
          <Link to="/auth?mode=signup">Create an account</Link>
        </Button>
      </>,
    );
  }

  if (error) {
    return shell(
      "We couldn't open this invitation",
      error,
      <div className="flex flex-col gap-3">
        <Button variant="outline" className={wideButton} onClick={() => void switchAccount()}>
          Use a different account
        </Button>
        <Button
          variant="ghost"
          className={wideButton}
          onClick={() => {
            clearPendingInvite();
            navigate('/dashboard', { replace: true });
          }}
        >
          Go to dashboard
        </Button>
      </div>,
    );
  }

  if (!invite) return null;

  if (invite.status !== 'pending') {
    const reason =
      invite.status === 'accepted'
        ? 'You already accepted this invitation.'
        : invite.status === 'expired'
          ? 'This invitation has expired. Ask the person who invited you to send a new one.'
          : 'This invitation is no longer active.';
    return shell(
      invite.tenantName,
      reason,
      <Button
        className={wideButton}
        onClick={() => {
          clearPendingInvite();
          navigate('/dashboard', { replace: true });
        }}
      >
        Go to dashboard
      </Button>,
    );
  }

  return shell(
    `Join ${invite.tenantName}?`,
    `${invite.invitedBy ? `${invite.invitedBy} invited you` : "You've been invited"} to work together on Mako.`,
    <>
      <dl className="mb-6 divide-y divide-border/60 rounded-2xl border border-border/70 bg-card text-sm">
        <div className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Users className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Organisation</dt>
            <dd className="truncate font-medium">{invite.tenantName}</dd>
          </div>
        </div>
        <div className="flex justify-between gap-3 px-4 py-3">
          <dt className="text-muted-foreground">Invited email</dt>
          <dd className="truncate font-medium">{invite.email}</dd>
        </div>
        {invite.invitedBy && (
          <div className="flex justify-between gap-3 px-4 py-3">
            <dt className="text-muted-foreground">Invited by</dt>
            <dd className="truncate font-medium">{invite.invitedBy}</dd>
          </div>
        )}
      </dl>
      <p className="mb-6 text-xs leading-relaxed text-muted-foreground">
        Its members will see your name and email. You can switch to it from the sidebar, and leave it any time.
      </p>
      <div className="flex flex-col gap-3">
        <Button className={wideButton} onClick={() => void accept()} disabled={acting !== null}>
          {acting === 'accept' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Accept invitation
        </Button>
        <Button variant="ghost" className={wideButton} onClick={() => void decline()} disabled={acting !== null}>
          {acting === 'decline' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Decline
        </Button>
      </div>
    </>,
  );
}
