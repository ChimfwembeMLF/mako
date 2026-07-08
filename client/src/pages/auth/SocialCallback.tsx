import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";

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

    if (!token && location.hash) {
      const hashParams = new URLSearchParams(location.hash.substring(1));
      token = hashParams.get("access_token") || hashParams.get("token");
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

    completeOAuthLogin(token)
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
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <AppBreadcrumbs />
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Completing sign in...</p>
        </div>
      </div>
    </div>
  );
}
