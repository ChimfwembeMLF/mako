import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, Loader2, ShieldAlert } from "lucide-react";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AuthLayout, PasswordField } from "@/components/auth/AuthLayout";
import { cn } from "@/lib/utils";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const longEnough = password.length >= 6;
  const matches = confirmPassword.length > 0 && password === confirmPassword;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !longEnough || !matches) return;
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      toast({ title: "Password changed", description: "Sign in with your new password." });
      navigate("/auth");
    } catch (error: unknown) {
      toast({
        title: "Couldn't change your password",
        description: error instanceof Error ? error.message : "The link may have expired. Request a new one.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout title="This link doesn't work" subtitle="Reset links expire after a while, and each one can only be used once.">
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <p>Request a new reset email from the sign-in page, then use the newest link.</p>
        </div>
        <Button asChild className="mt-6 h-12 w-full rounded-full text-base font-semibold">
          <Link to="/auth">Back to sign in</Link>
        </Button>
      </AuthLayout>
    );
  }

  const rule = (ok: boolean, text: string) => (
    <li className={cn("flex items-center gap-1.5", ok ? "text-green-700 dark:text-green-400" : "text-muted-foreground")}>
      <Check className={cn("h-3.5 w-3.5", !ok && "opacity-30")} /> {text}
    </li>
  );

  return (
    <AuthLayout title="Choose a new password" subtitle="Pick something you haven't used for Mako before.">
      <form onSubmit={handleReset} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <PasswordField id="password" value={password} onChange={setPassword} autoComplete="new-password" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Type it again</Label>
          <PasswordField id="confirm" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
        </div>
        <ul className="space-y-1 text-xs" aria-live="polite">
          {rule(longEnough, "At least 6 characters")}
          {rule(matches, "Both passwords match")}
        </ul>
        <Button type="submit" disabled={loading || !longEnough || !matches} className="h-12 w-full rounded-full text-base font-semibold">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {loading ? "Changing…" : "Change password"}
        </Button>
      </form>
      <Link to="/auth" className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </Link>
    </AuthLayout>
  );
};

export default ResetPassword;
