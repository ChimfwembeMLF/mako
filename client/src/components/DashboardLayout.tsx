import { PhoneVerifyPrompt } from "@/components/PhoneVerifyPrompt";
import { Outlet, useLocation } from "react-router-dom";
import { AppNavbar } from "@/components/AppNavbar";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { BackendStatusBanner } from "@/components/BackendStatusBanner";
import { OnboardingWizard, useNeedsOnboarding } from "@/components/OnboardingWizard";
import { pageWidthClass, resolvePageWidth } from "@/components/layout/PageContainer";
import { PageBreadcrumbProvider } from "@/hooks/usePageBreadcrumb";
import { resolveProductShell } from "@/lib/social-shell";
import { cn } from "@/lib/utils";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

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
        {/* On desktop the breadcrumbs sit in the top bar. */}
        <AppBreadcrumbs className="mb-4 w-full lg:hidden" />
        <Outlet />
      </div>
    </main>
  );
}

/** Open unless it was collapsed last time (the sidebar saves this in a cookie), or the screen is tablet-sized. */
function initialSidebarOpen(): boolean {
  if (typeof window === "undefined") return true;
  if (window.innerWidth >= 768 && window.innerWidth < 1024) return false;
  return !/(?:^|;\s*)sidebar:state=false/.test(document.cookie);
}

export function DashboardLayout() {
  const { needs, dismiss } = useNeedsOnboarding();
  const { pathname } = useLocation();
  const shell = resolveProductShell(pathname);

  return (
    <SidebarProvider defaultOpen={initialSidebarOpen()}>
      <AppSidebar />
      <PageBreadcrumbProvider>
        <div className="min-h-screen flex flex-col bg-background flex-1 w-full min-w-0 overflow-x-clip" data-product-shell={shell}>
          <AppNavbar />
          <BackendStatusBanner />

          <DashboardMain />

          {needs ? <OnboardingWizard onComplete={dismiss} /> : <PhoneVerifyPrompt />}
        </div>
      </PageBreadcrumbProvider>
    </SidebarProvider>
  );
}
