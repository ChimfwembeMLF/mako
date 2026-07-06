import React, { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { TenantProvider } from "@/hooks/useTenant";
import { WorkspaceProvider } from "@/hooks/useWorkspace";
import { BackendStatusProvider } from "@/hooks/useBackendStatus";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { isNetworkError } from "@/lib/api-errors";
import { DashboardLayout } from "@/components/DashboardLayout";

// Existing pages — landing/auth stay eager for first paint
import LandingPage from "./pages/LandingPage";
import Auth from "./pages/auth/Auth";

const Index = lazy(() => import("./pages/Index"));
const BrandBrain = lazy(() => import("./pages/BrandBrain"));
const ContentEngine = lazy(() => import("./pages/ContentEngine"));
const ContentDetailPage = lazy(() => import("./pages/ContentDetailPage"));
const EditContent = lazy(() => import("./pages/EditContent"));
const CampaignsPage = lazy(() => import("./pages/CampaignsPage"));
const Scheduler = lazy(() => import("./pages/Scheduler"));
const LeadAgent = lazy(() => import("./pages/LeadAgent"));
const Analytics = lazy(() => import("./pages/Analytics"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ContactForm = lazy(() => import("./pages/ContactForm"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const PublisherConnect = lazy(() => import("./pages/PublisherConnect"));
const NotFound = lazy(() => import("./pages/NotFound"));

// RBAC & admin pages
const RolesPage = lazy(() => import("./pages/admin/RolesPage"));
const MakerCheckerConfigPage = lazy(() => import("./pages/admin/MakerCheckerConfigPage"));
const SystemSettingsPage = lazy(() => import("./pages/admin/SystemSettingsPage"));
const BackofficePage = lazy(() => import("./pages/admin/BackofficePage"));
const QueueJobsPage = lazy(() => import("./pages/admin/QueueJobsPage"));
const TeamPage = lazy(() => import("./pages/team/TeamPage"));
const UserPermissionsPage = lazy(() => import("./pages/team/UserPermissionsPage"));
const ApprovalsPage = lazy(() => import("./pages/ApprovalsPage"));
const MediaLibraryPage = lazy(() => import("./pages/MediaLibraryPage"));
const AdsPage = lazy(() => import('./pages/AdsPage'));
const TemplatesPage = lazy(() => import("./pages/TemplatesPage"));
const TemplateEditPage = lazy(() => import("./pages/TemplateEditPage"));
const RepliesPage = lazy(() => import("./pages/RepliesPage"));
const AuditLogsPage = lazy(() => import("./pages/AuditLogsPage"));
const BillingPage = lazy(() => import("./pages/BillingPage"));
const ExportPage = lazy(() => import("./pages/ExportPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const ChatbotPage = lazy(() => import("./pages/chatbot/ChatbotPage"));
const ChatbotKnowledgePage = lazy(() => import("./pages/chatbot/ChatbotKnowledgePage"));
const ChatbotSessionsPage = lazy(() => import("./pages/chatbot/ChatbotSessionsPage"));
const WorkspacesPage = lazy(() => import("./pages/WorkspacesPage"));
const SocialCallback = lazy(() => import("./pages/auth/SocialCallback"));
const PrivacyPage = lazy(() => import("./pages/legal/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/legal/TermsPage"));
const DataDeletionPage = lazy(() => import("./pages/legal/DataDeletionPage"));
import { SuperAdminRoute } from "@/components/SuperAdminRoute";
import { ChatbotWidgetLoader } from "@/components/ChatbotWidgetLoader";
import { DataProtectionBanner } from "@/components/DataProtectionBanner";
import { OfflineGate } from "@/components/OfflineGate";
import { PwaUpdatePrompt } from "@/components/PwaUpdatePrompt";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => (isNetworkError(error) ? failureCount < 2 : failureCount < 1),
      throwOnError: false,
    },
    mutations: { throwOnError: false },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
      <div className="animate-pulse text-sm">Loading…</div>
    </div>
  );
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        <div className="animate-pulse text-sm">Loading…</div>
      </div>
    );
  }
  if (user) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen text-muted-foreground">
      <div className="animate-pulse text-sm">Loading…</div>
    </div>
  );
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BackendStatusProvider>
        <AuthProvider>
          <TenantProvider>
            <WorkspaceProvider>
            <ErrorBoundary label="Application">
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <OfflineGate>
              <PwaUpdatePrompt />
              <ChatbotWidgetLoader />
              <DataProtectionBanner />
              <Routes>
                {/* Public routes */}
                <Route path="/auth" element={<PublicOnly><Auth /></PublicOnly>} />
                <Route path="/auth/callback" element={<LazyPage><SocialCallback /></LazyPage>} />
                <Route path="/reset-password" element={<LazyPage><ResetPassword /></LazyPage>} />
                <Route path="/contact/:sourceId" element={<LazyPage><ContactForm /></LazyPage>} />
                <Route path="/privacy" element={<LazyPage><PrivacyPage /></LazyPage>} />
                <Route path="/terms" element={<LazyPage><TermsPage /></LazyPage>} />
                <Route path="/data-deletion" element={<LazyPage><DataDeletionPage /></LazyPage>} />
                <Route path="/" element={<HomeRoute />} />
                <Route path="/home" element={<HomeRoute />} />

                {/* Protected app routes */}
                <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                  <Route path="/dashboard" element={<LazyPage><Index /></LazyPage>} />
                  <Route path="/index" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/brand-brain" element={<LazyPage><BrandBrain /></LazyPage>} />
                  <Route path="/content" element={<LazyPage><ContentEngine /></LazyPage>} />
                  <Route path="/campaigns" element={<LazyPage><CampaignsPage /></LazyPage>} />
                  <Route path="/content/edit/:id" element={<LazyPage><EditContent /></LazyPage>} />
                  <Route path="/content/:id" element={<LazyPage><ContentDetailPage /></LazyPage>} />
                  <Route path="/scheduler" element={<LazyPage><Scheduler /></LazyPage>} />
                  <Route path="/leads" element={<LazyPage><LeadAgent /></LazyPage>} />
                  <Route path="/analytics" element={<LazyPage><Analytics /></LazyPage>} />
                  <Route path="/reports" element={<LazyPage><ReportsPage /></LazyPage>} />
                  <Route path="/publisher" element={<LazyPage><PublisherConnect /></LazyPage>} />
                  <Route path="/settings" element={<LazyPage><SettingsPage /></LazyPage>} />

                  {/* Media */}
                  <Route path="/media" element={<LazyPage><MediaLibraryPage /></LazyPage>} />

                  {/* Ads Management */}
                  <Route path="/ads" element={<LazyPage><AdsPage /></LazyPage>} />

                  {/* Templates */}
                  <Route path="/templates" element={<LazyPage><TemplatesPage /></LazyPage>} />
                  <Route path="/templates/:id" element={<LazyPage><TemplateEditPage /></LazyPage>} />

                  {/* Replies */}
                  <Route path="/replies" element={<LazyPage><RepliesPage /></LazyPage>} />
                  <Route path="/chatbot/knowledge" element={<LazyPage><ChatbotKnowledgePage /></LazyPage>} />
                  <Route path="/chatbot/sessions" element={<LazyPage><ChatbotSessionsPage /></LazyPage>} />
                  <Route path="/chatbot" element={<LazyPage><ChatbotPage /></LazyPage>} />

                  {/* Approvals (maker-checker) */}
                  <Route path="/approvals" element={<LazyPage><ApprovalsPage /></LazyPage>} />

                  {/* Team management */}
                  <Route path="/team" element={<LazyPage><TeamPage /></LazyPage>} />
                  <Route path="/team/:userId/permissions" element={<LazyPage><UserPermissionsPage /></LazyPage>} />

                  {/* Audit */}
                  <Route path="/audit" element={<LazyPage><AuditLogsPage /></LazyPage>} />

                  {/* Billing */}
                  <Route path="/billing" element={<LazyPage><BillingPage /></LazyPage>} />

                  {/* Data Export */}
                  <Route path="/export" element={<LazyPage><ExportPage /></LazyPage>} />

                  {/* Workspace Management */}
                  <Route path="/workspaces" element={<LazyPage><WorkspacesPage /></LazyPage>} />

                  {/* Tenant admin */}
                  <Route path="/admin/roles" element={<LazyPage><RolesPage /></LazyPage>} />
                  <Route path="/admin/maker-checker" element={<LazyPage><MakerCheckerConfigPage /></LazyPage>} />

                  {/* Platform backoffice — Super Admin only */}
                  <Route path="/admin/system" element={<SuperAdminRoute><LazyPage><SystemSettingsPage /></LazyPage></SuperAdminRoute>} />
                  <Route path="/admin/backoffice" element={<LazyPage><BackofficePage /></LazyPage>} />
                  <Route path="/admin/queues" element={<LazyPage><QueueJobsPage /></LazyPage>} />
                </Route>

                <Route path="*" element={<LazyPage><NotFound /></LazyPage>} />
              </Routes>
              </OfflineGate>
            </BrowserRouter>
          </ErrorBoundary>
            </WorkspaceProvider>
        </TenantProvider>
      </AuthProvider>
      </BackendStatusProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
