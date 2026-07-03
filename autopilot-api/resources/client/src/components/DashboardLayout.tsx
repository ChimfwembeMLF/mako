import { Outlet, useLocation } from "react-router-dom";
import { AppNavbar } from "@/components/AppNavbar";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { BackendStatusBanner } from "@/components/BackendStatusBanner";
import { OnboardingWizard, useNeedsOnboarding } from "@/components/OnboardingWizard";
import { pageWidthClass, resolvePageWidth } from "@/components/layout/PageContainer";
import { ThemeProvider } from "@/hooks/useTheme";
import { PageBreadcrumbProvider } from "@/hooks/usePageBreadcrumb";
import { cn } from "@/lib/utils";

function DashboardMain() {
  const { pathname } = useLocation();
  const width = resolvePageWidth(pathname);

  return (
    <main className="flex-1 overflow-auto m-3 sm:m-4 md:m-6 min-w-0">
      <div
        className={cn(
          "mx-auto w-full min-w-0",
          pageWidthClass(width),
        )}
      >
        <AppBreadcrumbs className="mb-3 sm:mb-4 w-full" />
        <Outlet />
      </div>
    </main>
  );
}

export function DashboardLayout() {
  const { needs, dismiss } = useNeedsOnboarding();

  return (
    <ThemeProvider>
    <PageBreadcrumbProvider>
    <div className="min-h-screen flex flex-col relative">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute top-1/3 -left-32 h-80 w-80 rounded-full bg-accent/6 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-secondary/5 blur-3xl" />
      </div>

      <AppNavbar />
      <BackendStatusBanner />

      <DashboardMain />

      {needs && <OnboardingWizard onComplete={dismiss} />}
    </div>
    </PageBreadcrumbProvider>
    </ThemeProvider>
  );
}
