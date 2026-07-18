import { Outlet, useLocation } from "react-router-dom";
import { AppNavbar } from "@/components/AppNavbar";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { BackendStatusBanner } from "@/components/BackendStatusBanner";
import { OnboardingWizard, useNeedsOnboarding } from "@/components/OnboardingWizard";
import { pageWidthClass, resolvePageWidth } from "@/components/layout/PageContainer";
import { PageBreadcrumbProvider } from "@/hooks/usePageBreadcrumb";
import { cn } from "@/lib/utils";

function DashboardMain() {
  const { pathname } = useLocation();
  const width = resolvePageWidth(pathname);

  return (
    <main className="flex-1 overflow-auto min-w-0">
      <div
        className={cn(
          "mx-auto w-full min-w-0 px-4 md:px-6 py-6",
          pageWidthClass(width),
        )}
      >
        <AppBreadcrumbs className="mb-4 w-full" />
        <Outlet />
      </div>
    </main>
  );
}

export function DashboardLayout() {
  const { needs, dismiss } = useNeedsOnboarding();

  return (
    <PageBreadcrumbProvider>
    <div className="min-h-screen flex flex-col bg-background">
      <AppNavbar />
      <BackendStatusBanner />

      <DashboardMain />

      {needs && <OnboardingWizard onComplete={dismiss} />}
    </div>
    </PageBreadcrumbProvider>
  );
}
