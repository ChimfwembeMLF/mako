import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, MailCheck, ShieldAlert, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 space-y-4 text-center">{children}</CardContent>
      </Card>
    </div>
  );

  if (!id || !token) {
    return shell(
      <>
        <ShieldAlert className="h-8 w-8 mx-auto text-destructive" />
        <h1 className="text-lg font-semibold">This invitation link is incomplete</h1>
        <p className="text-sm text-muted-foreground">Open the link from your invitation email again.</p>
        <Button asChild variant="outline">
          <Link to="/">Go to Mako</Link>
        </Button>
      </>,
    );
  }

  if (authLoading || (user && loading && !invite && !error)) {
    return shell(<Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />);
  }

  if (!user) {
    return shell(
      <>
        <MailCheck className="h-8 w-8 mx-auto text-primary" />
        <h1 className="text-lg font-semibold">You've been invited to a Mako workspace</h1>
        <p className="text-sm text-muted-foreground">
          Sign in, or create an account, with the email address the invitation was sent to. You'll come
          back here to accept it.
        </p>
        <Button asChild className="w-full">
          <Link to="/auth">Sign in or create account</Link>
        </Button>
      </>,
    );
  }

  if (error) {
    return shell(
      <>
        <ShieldAlert className="h-8 w-8 mx-auto text-destructive" />
        <h1 className="text-lg font-semibold">We couldn't open this invitation</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button variant="outline" onClick={() => void switchAccount()}>
            Use a different account
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              clearPendingInvite();
              navigate('/dashboard', { replace: true });
            }}
          >
            Go to dashboard
          </Button>
        </div>
      </>,
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
      <>
        <Users className="h-8 w-8 mx-auto text-muted-foreground" />
        <h1 className="text-lg font-semibold">{invite.tenantName}</h1>
        <p className="text-sm text-muted-foreground">{reason}</p>
        <Button
          onClick={() => {
            clearPendingInvite();
            navigate('/dashboard', { replace: true });
          }}
        >
          Go to dashboard
        </Button>
      </>,
    );
  }

  return shell(
    <>
      <Users className="h-8 w-8 mx-auto text-primary" />
      <h1 className="text-lg font-semibold">Join {invite.tenantName}?</h1>
      <p className="text-sm text-muted-foreground">
        {invite.invitedBy ? `${invite.invitedBy} invited ` : "You've been invited as "}
        <strong className="text-foreground">{invite.email}</strong> to work in{' '}
        <strong className="text-foreground">{invite.tenantName}</strong> on Mako. Its members will see your
        name and email, and you'll be able to switch to it from the sidebar.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
        <Button onClick={() => void accept()} disabled={acting !== null}>
          {acting === 'accept' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Accept invitation
        </Button>
        <Button variant="outline" onClick={() => void decline()} disabled={acting !== null}>
          {acting === 'decline' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Decline
        </Button>
      </div>
    </>,
  );
}
