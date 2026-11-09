import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Linkedin, Loader2, Mail, MailCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { authApi, getSocialLoginUrl } from "@/lib/api";
import { FormInput } from "@/components/forms";
import { AuthLayout, PasswordField } from "@/components/auth/AuthLayout";
import { cn } from "@/lib/utils";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

const SOCIAL_PROVIDERS = [
  { id: "google" as const, label: "Google", Icon: GoogleIcon, iconClass: "" },
  { id: "linkedin" as const, label: "LinkedIn", Icon: Linkedin, iconClass: "text-[#0A66C2]" },
];

type Mode = "signin" | "signup" | "forgot" | "reset-code";

const COPY: Record<Mode, { title: string; subtitle: string }> = {
  signin: { title: "Welcome back", subtitle: "Sign in to plan, publish and reply from one place." },
  signup: { title: "Create your account", subtitle: "Free to start. No card needed, and you can pay with mobile money later." },
  forgot: { title: "Reset your password", subtitle: "Enter the email you sign in with. We'll send you a way back in." },
  "reset-code": { title: "Check your email", subtitle: "" },
};

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>(searchParams.get("mode") === "signup" ? "signup" : "signin");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { login, register, requestPasswordReset } = useAuth();

  useEffect(() => {
    if (searchParams.get("mode") === "signup") setMode("signup");
    const invitedEmail = searchParams.get("email");
    if (invitedEmail) {
      setEmail(invitedEmail);
      setMode("signup");
    }
  }, [searchParams]);

  const isSignUp = mode === "signup";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        await register({
          email,
          password,
          firstName: fullName.split(" ")[0] || "",
          lastName: fullName.split(" ").slice(1).join(" ") || "",
        });
        toast({ title: "Welcome to Mako", description: "Your account is ready." });
      } else {
        await login(email, password);
      }
      navigate("/dashboard");
    } catch (err: unknown) {
      toast({
        title: isSignUp ? "Couldn't create your account" : "Couldn't sign you in",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setMode("reset-code");
    } catch (err: unknown) {
      toast({ title: "Couldn't send the reset email", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResetWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.resetPasswordWithCode(email, resetCode.trim(), newPassword);
      toast({ title: "Password changed", description: "Sign in with your new password." });
      setResetCode("");
      setNewPassword("");
      setPassword("");
      setMode("signin");
    } catch (err: unknown) {
      toast({ title: "Couldn't reset your password", description: err instanceof Error ? err.message : "Check the code and try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const backToSignIn = (
    <button
      type="button"
      onClick={() => setMode("signin")}
      className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> Back to sign in
    </button>
  );

  const submitClass = "h-12 w-full rounded-full text-base font-semibold";

  return (
    <AuthLayout
      title={COPY[mode].title}
      subtitle={
        mode === "reset-code" ? (
          <>
            If <span className="font-medium text-foreground">{email}</span> has an account, we've sent it a reset link. If its phone is verified, we've also texted a 6-digit code you can use below.
          </>
        ) : (
          COPY[mode].subtitle
        )
      }
    >
      {mode === "forgot" && (
        <>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <FormInput id="email" type="email" icon={Mail} autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <Button type="submit" disabled={loading} className={submitClass}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Sending…" : "Send reset instructions"}
            </Button>
          </form>
          {backToSignIn}
        </>
      )}

      {mode === "reset-code" && (
        <>
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-border/70 bg-card p-4">
            <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">Open the link in the email, or enter the texted code here.</p>
          </div>
          <form onSubmit={handleResetWithCode} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reset-code">Code from the text message</Label>
              <FormInput
                id="reset-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ""))}
                className="text-center font-mono text-lg tracking-[0.5em]"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reset-password">New password</Label>
              <PasswordField id="reset-password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
              <p className="text-xs text-muted-foreground">At least 6 characters.</p>
            </div>
            <Button type="submit" disabled={loading || resetCode.length !== 6 || newPassword.length < 6} className={submitClass}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Changing…" : "Change password"}
            </Button>
          </form>
          {backToSignIn}
        </>
      )}

      {(mode === "signin" || mode === "signup") && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {SOCIAL_PROVIDERS.map(({ id, label, Icon, iconClass }) => (
              <Button
                key={id}
                type="button"
                variant="outline"
                className="h-12 gap-2 rounded-full border-border bg-card text-sm font-medium hover:bg-muted"
                onClick={() => {
                  window.location.href = getSocialLoginUrl(id);
                }}
                aria-label={`Continue with ${label}`}
              >
                <Icon className={cn("h-5 w-5", iconClass)} />
                {label}
              </Button>
            ))}
          </div>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or with email
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Your name</Label>
                <FormInput id="name" icon={User} autoComplete="name" placeholder="Your full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <FormInput id="email" type="email" icon={Mail} autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {!isSignUp && (
                  <button type="button" onClick={() => setMode("forgot")} className="text-xs font-medium text-muted-foreground hover:text-foreground">
                    Forgot password?
                  </button>
                )}
              </div>
              <PasswordField id="password" value={password} onChange={setPassword} autoComplete={isSignUp ? "new-password" : "current-password"} />
              {isSignUp && <p className="text-xs text-muted-foreground">At least 6 characters.</p>}
            </div>
            <Button type="submit" disabled={loading} className={submitClass}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? (isSignUp ? "Creating your account…" : "Signing in…") : isSignUp ? "Create account" : "Sign in"}
            </Button>
          </form>

          {isSignUp && (
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              By creating an account you agree to the{" "}
              <a href="/terms" className="underline underline-offset-2 hover:text-foreground">Terms</a> and{" "}
              <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">Privacy policy</a>.
            </p>
          )}

          <p className="mt-6 text-sm text-muted-foreground">
            {isSignUp ? "Already have an account?" : "New to Mako?"}{" "}
            <button type="button" onClick={() => setMode(isSignUp ? "signin" : "signup")} className="font-semibold text-foreground underline-offset-2 hover:underline">
              {isSignUp ? "Sign in" : "Create an account"}
            </button>
          </p>
        </>
      )}
    </AuthLayout>
  );
};

export default Auth;
