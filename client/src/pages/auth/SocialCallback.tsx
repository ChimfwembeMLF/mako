import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";

export default function SocialCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { completeOAuthLogin } = useAuth();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const params = new URLSearchParams(location.search);
    let token = params.get("token");

    let refreshToken = params.get("refreshToken");

    if (!token && location.hash) {
      const hashParams = new URLSearchParams(location.hash.substring(1));
      token = hashParams.get("access_token") || hashParams.get("token");
      if (!refreshToken) refreshToken = hashParams.get("refreshToken");
    }

    const error = params.get("error");

    if (error) {
      toast({ title: "Authentication failed", description: error, variant: "destructive" });
      navigate("/auth", { replace: true });
      return;
    }

    if (!token) {
      toast({ title: "Missing token", description: "Please try again", variant: "destructive" });
      navigate("/auth", { replace: true });
      return;
    }

    completeOAuthLogin(token, refreshToken || undefined)
      .then(() => {
        toast({ title: "Success", description: "You are now logged in" });
        navigate("/dashboard", { replace: true });
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Failed to complete sign in";
        toast({ title: "Authentication failed", description: message, variant: "destructive" });
        navigate("/auth", { replace: true });
      });
  }, [location, navigate, toast, completeOAuthLogin]);

  return (
    <AuthLayout title="Signing you in…" subtitle="Finishing up with your account. This only takes a moment." showcase={false}>
      <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        Checking your details
      </div>
    </AuthLayout>
  );
}
