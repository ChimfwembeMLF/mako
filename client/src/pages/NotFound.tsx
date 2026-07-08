import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";

const NotFound = () => {
  const location = useLocation();
  const { user } = useAuth();
  const homeTo = user ? "/dashboard" : "/";

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <AppBreadcrumbs />
        <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold font-display">404</h1>
        <p className="mb-2 text-xl text-muted-foreground">Page not found</p>
        <p className="mb-6 text-sm text-muted-foreground break-all">
          <code className="rounded bg-background px-2 py-1">{location.pathname}</code>
        </p>
        <Button asChild>
          <Link to={homeTo}>{user ? "Back to dashboard" : "Return to home"}</Link>
        </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
