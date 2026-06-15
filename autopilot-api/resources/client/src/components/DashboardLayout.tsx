import { Outlet } from "react-router-dom";
import { AppNavbar } from "@/components/AppNavbar";
import { BackendStatusBanner } from "@/components/BackendStatusBanner";
import { OnboardingWizard, useNeedsOnboarding } from "@/components/OnboardingWizard";
import { ThemeProvider } from "@/hooks/useTheme";

export function DashboardLayout() {
  const { needs, dismiss } = useNeedsOnboarding();

  return (
    <ThemeProvider>
    <div className="min-h-screen flex flex-col relative">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute top-1/3 -left-32 h-80 w-80 rounded-full bg-accent/6 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-secondary/5 blur-3xl" />
      </div>

      <AppNavbar />
      <BackendStatusBanner />

      <main className="flex-1 overflow-auto m-4 md:m-6">
        <Outlet />
      </main>

      {needs && <OnboardingWizard onComplete={dismiss} />}
    </div>
    </ThemeProvider>
  );
}
