import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { TenantProvider } from "@/hooks/useTenant";
import { BackendStatusProvider } from "@/hooks/useBackendStatus";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { isNetworkError } from "@/lib/api-errors";
import { DashboardLayout } from "@/components/DashboardLayout";

// Existing pages
import Index from "./pages/Index";
import LandingPage from "./pages/LandingPage";
import BrandBrain from "./pages/BrandBrain";
import ContentEngine from "./pages/ContentEngine";
import ContentDetailPage from "./pages/ContentDetailPage";
import EditContent from "./pages/EditContent";
import CampaignsPage from "./pages/CampaignsPage";
import Scheduler from "./pages/Scheduler";
import LeadAgent from "./pages/LeadAgent";
import Analytics from "./pages/Analytics";
import SettingsPage from "./pages/SettingsPage";
import ContactForm from "./pages/ContactForm";
import Auth from "./pages/auth/Auth";
import ResetPassword from "./pages/ResetPassword";
import PublisherConnect from "./pages/PublisherConnect";
import NotFound from "./pages/NotFound";

// New RBAC & admin pages
import RolesPage from "./pages/admin/RolesPage";
import MakerCheckerConfigPage from "./pages/admin/MakerCheckerConfigPage";
import SystemSettingsPage from "./pages/admin/SystemSettingsPage";
import BackofficePage from "./pages/admin/BackofficePage";
import QueueJobsPage from "./pages/admin/QueueJobsPage";
import TeamPage from "./pages/team/TeamPage";
import UserPermissionsPage from "./pages/team/UserPermissionsPage";
import ApprovalsPage from "./pages/ApprovalsPage";
import MediaLibraryPage from "./pages/MediaLibraryPage";
import TemplatesPage from "./pages/TemplatesPage";
import TemplateEditPage from "./pages/TemplateEditPage";
import RepliesPage from "./pages/RepliesPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import BillingPage from "./pages/BillingPage";
import ExportPage from "./pages/ExportPage";
import ReportsPage from "./pages/ReportsPage";
import ChatbotPage from "./pages/chatbot/ChatbotPage";
import ChatbotKnowledgePage from "./pages/chatbot/ChatbotKnowledgePage";
import ChatbotSessionsPage from "./pages/chatbot/ChatbotSessionsPage";
import WorkspacesPage from "./pages/WorkspacesPage";
import SocialCallback from "./pages/auth/SocialCallback";
import PrivacyPage from "./pages/legal/PrivacyPage";
import TermsPage from "./pages/legal/TermsPage";
import DataDeletionPage from "./pages/legal/DataDeletionPage";
import { SuperAdminRoute } from "@/components/SuperAdminRoute";
import { ChatbotWidgetLoader } from "@/components/ChatbotWidgetLoader";

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
            <ErrorBoundary label="Application">
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ChatbotWidgetLoader />
              <Routes>
                {/* Public routes */}
                <Route path="/auth" element={<PublicOnly><Auth /></PublicOnly>} />
                <Route path="/auth/callback" element={<SocialCallback />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/contact/:sourceId" element={<ContactForm />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/data-deletion" element={<DataDeletionPage />} />
                <Route path="/" element={<HomeRoute />} />

                {/* Protected app routes */}
                <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                  <Route path="/dashboard" element={<Index />} />
                  <Route path="/brand-brain" element={<BrandBrain />} />
                  <Route path="/content" element={<ContentEngine />} />
                  <Route path="/campaigns" element={<CampaignsPage />} />
                  <Route path="/content/edit/:id" element={<EditContent />} />
                  <Route path="/content/:id" element={<ContentDetailPage />} />
                  <Route path="/scheduler" element={<Scheduler />} />
                  <Route path="/leads" element={<LeadAgent />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/publisher" element={<PublisherConnect />} />
                  <Route path="/settings" element={<SettingsPage />} />

                  {/* Media */}
                  <Route path="/media" element={<MediaLibraryPage />} />

                  {/* Templates */}
                  <Route path="/templates" element={<TemplatesPage />} />
                  <Route path="/templates/:id" element={<TemplateEditPage />} />

                  {/* Replies */}
                  <Route path="/replies" element={<RepliesPage />} />
                  <Route path="/chatbot" element={<ChatbotPage />} />
                  <Route path="/chatbot/knowledge" element={<ChatbotKnowledgePage />} />
                  <Route path="/chatbot/sessions" element={<ChatbotSessionsPage />} />

                  {/* Approvals (maker-checker) */}
                  <Route path="/approvals" element={<ApprovalsPage />} />

                  {/* Team management */}
                  <Route path="/team" element={<TeamPage />} />
                  <Route path="/team/:userId/permissions" element={<UserPermissionsPage />} />

                  {/* Audit */}
                  <Route path="/audit" element={<AuditLogsPage />} />

                  {/* Billing */}
                  <Route path="/billing" element={<BillingPage />} />

                  {/* Data Export */}
                  <Route path="/export" element={<ExportPage />} />

                  {/* Workspace Management */}
                  <Route path="/workspaces" element={<WorkspacesPage />} />

                  {/* Tenant admin */}
                  <Route path="/admin/roles" element={<RolesPage />} />
                  <Route path="/admin/maker-checker" element={<MakerCheckerConfigPage />} />

                  {/* Platform backoffice — Super Admin only */}
                  <Route path="/admin/system" element={<SuperAdminRoute><SystemSettingsPage /></SuperAdminRoute>} />
                  <Route path="/admin/backoffice" element={<BackofficePage />} />
                  <Route path="/admin/queues" element={<QueueJobsPage />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </ErrorBoundary>
        </TenantProvider>
      </AuthProvider>
      </BackendStatusProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
