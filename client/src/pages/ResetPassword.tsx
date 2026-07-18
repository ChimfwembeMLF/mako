import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Field, FormInput } from "@/components/forms";
import { Lock, Rocket } from "lucide-react";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      toast({ title: "Password updated!", description: "You can now sign in with your new password." });
      navigate("/auth");
    } catch (error: unknown) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to reset password", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6">
          <AppBreadcrumbs />
          <Card className="shadow-card border-border/50 rounded-xl">
            <CardContent className="p-8 text-center text-muted-foreground">
              <p>Invalid or expired reset link. Please request a new password reset.</p>
              <Button variant="link" className="mt-4" onClick={() => navigate("/auth")}>Back to Sign In</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <AppBreadcrumbs />
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-elevated">
            <Rocket className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold font-display">Set New Password</h1>
          <p className="text-sm text-muted-foreground">Enter your new password below</p>
        </div>

        <Card className="shadow-card border-border/50 rounded-xl">
          <CardContent className="pt-6">
            <form onSubmit={handleReset} className="space-y-4">
              <Field label="New password" htmlFor="password" required hint="At least 6 characters">
                <FormInput id="password" type="password" icon={Lock} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </Field>
              <Field label="Confirm password" htmlFor="confirm" required>
                <FormInput id="confirm" type="password" icon={Lock} placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
              </Field>
              <Button type="submit" disabled={loading} className="w-full h-11 rounded-lg bg-primary border-0">
                {loading ? "Updating…" : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
