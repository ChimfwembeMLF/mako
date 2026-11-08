import React, { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { ConfirmModalProvider } from "@/components/ConfirmModal";
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
import MobileDownloadPage from "./pages/MobileDownloadPage";

/** Page bundles, kept so they can be fetched in the background once the app is idle. */
const pageLoaders: Array<() => Promise<unknown>> = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches React.lazy's own signature
function lazyPage<T extends React.ComponentType<any>>(load: () => Promise<{ default: T }>) {
  pageLoaders.push(load);
  return lazy(load);
}

/**
 * Fetches every page bundle while the browser is idle, one at a time, so switching
 * pages is instant. Skipped when the visitor has asked to save data.
 */
function usePreloadPages(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return;
    let cancelled = false;
    const ric = (window as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const idle = (cb: () => void) => (ric ? ric.call(window, cb) : window.setTimeout(cb, 300));
    const queue = [...pageLoaders];
    const next = () => {
      if (cancelled) return;
      const load = queue.shift();
      if (!load) return;
      load().catch(() => {}).finally(() => idle(next));
    };
    const start = window.setTimeout(() => idle(next), 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(start);
    };
  }, [enabled]);
}

const Index = lazyPage(() => import("./pages/Index"));
const SocialDashboardPage = lazyPage(() => import("./pages/social/SocialDashboardPage"));
const BrandBrain = lazyPage(() => import("./pages/BrandBrain"));
const ContentEngine = lazyPage(() => import("./pages/ContentEngine"));
const ContentDetailPage = lazyPage(() => import("./pages/ContentDetailPage"));
const EditContent = lazyPage(() => import("./pages/EditContent"));
const CampaignsPage = lazyPage(() => import("./pages/CampaignsPage"));
const CampaignDetailPage = lazyPage(() => import("./pages/CampaignDetailPage"));
const AutomationRunPage = lazyPage(() => import("./pages/AutomationRunPage"));
const Scheduler = lazyPage(() => import("./pages/Scheduler"));
const LeadAgent = lazyPage(() => import("./pages/LeadAgent"));
const WhatsappHubPage = lazyPage(() => import("./pages/WhatsappHubPage"));
const WhatsappTemplatesPage = lazyPage(() => import("./pages/WhatsappTemplatesPage"));
const WhatsappBotsPage = lazyPage(() => import("./pages/whatsapp/WhatsappBotsPage"));
const WhatsappBotBuilderPage = lazyPage(() => import("./pages/whatsapp/WhatsappBotBuilderPage"));
const Analytics = lazyPage(() => import("./pages/Analytics"));
const SettingsPage = lazyPage(() => import("./pages/SettingsPage"));
const ContactForm = lazyPage(() => import("./pages/ContactForm"));
const ResetPassword = lazyPage(() => import("./pages/ResetPassword"));
const PublisherConnect = lazyPage(() => import("./pages/PublisherConnect"));
const NotFound = lazyPage(() => import("./pages/NotFound"));

// RBAC & admin pages
const RolesPage = lazyPage(() => import("./pages/admin/RolesPage"));
const MakerCheckerConfigPage = lazyPage(() => import("./pages/admin/MakerCheckerConfigPage"));
const SystemSettingsPage = lazyPage(() => import("./pages/admin/SystemSettingsPage"));
const BackofficePage = lazyPage(() => import("./pages/admin/BackofficePage"));
const QueueJobsPage = lazyPage(() => import("./pages/admin/QueueJobsPage"));
const TeamPage = lazyPage(() => import("./pages/team/TeamPage"));
const UserPermissionsPage = lazyPage(() => import("./pages/team/UserPermissionsPage"));
const ApprovalsPage = lazyPage(() => import("./pages/ApprovalsPage"));
const MediaLibraryPage = lazyPage(() => import("./pages/MediaLibraryPage"));
const AdsPage = lazyPage(() => import('./pages/AdsPage'));
const TemplatesPage = lazyPage(() => import("./pages/TemplatesPage"));
const TemplateEditPage = lazyPage(() => import("./pages/TemplateEditPage"));
const RepliesPage = lazyPage(() => import("./pages/RepliesPage"));
const MailDashboardPage = lazyPage(() => import("./pages/MailDashboardPage"));
const AuditLogsPage = lazyPage(() => import("./pages/AuditLogsPage"));
const BillingPage = lazyPage(() => import("./pages/BillingPage"));
const ExportPage = lazyPage(() => import("./pages/ExportPage"));
const ReportsPage = lazyPage(() => import("./pages/ReportsPage"));
const ChatbotPage = lazyPage(() => import("./pages/chatbot/ChatbotPage"));
const ChatbotKnowledgePage = lazyPage(() => import("./pages/chatbot/ChatbotKnowledgePage"));
const ChatbotSessionsPage = lazyPage(() => import("./pages/chatbot/ChatbotSessionsPage"));
const WorkspacesPage = lazyPage(() => import("./pages/WorkspacesPage"));
const SocialCallback = lazyPage(() => import("./pages/auth/SocialCallback"));
const InvitePage = lazyPage(() => import("./pages/auth/InvitePage"));
const PrivacyPage = lazyPage(() => import("./pages/legal/PrivacyPage"));
const TermsPage = lazyPage(() => import("./pages/legal/TermsPage"));
const DataDeletionPage = lazyPage(() => import("./pages/legal/DataDeletionPage"));
import { SuperAdminRoute } from "@/components/SuperAdminRoute";
import { ThemeProvider } from "@/hooks/useTheme";
import { ChatbotWidgetLoader } from "@/components/ChatbotWidgetLoader";
import { DataProtectionBanner } from "@/components/DataProtectionBanner";
import { OfflineGate } from "@/components/OfflineGate";
import { RouteProgress } from "@/components/RouteProgress";

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

/**
 * Navigations run as transitions (see BrowserRouter below), so the current page stays
 * on screen while the next one's code loads; this bar only shows on a first visit.
 */
function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteProgress />}>{children}</Suspense>;
}

function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return <RouteProgress />;
  }
  if (user) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

/** An invite link opened while signed out resumes here after sign-in (see InvitePage). */
function pendingInvitePath(): string | null {
  try {
    const raw = localStorage.getItem("mako_pending_invite");
    const inv = raw ? JSON.parse(raw) : null;
    if (!inv?.id || !inv?.token) return null;
    return `/invite?id=${encodeURIComponent(inv.id)}&token=${encodeURIComponent(inv.token)}`;
  } catch {
    return null;
  }
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  usePreloadPages(Boolean(user));
  if (loading) return <RouteProgress />;
  if (!user) return <Navigate to="/auth" replace />;
  const invite = pendingInvitePath();
  if (invite) return <Navigate to={invite} replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <RouteProgress />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BackendStatusProvider>
        <AuthProvider>
          <TenantProvider>
            <ThemeProvider>
            <WorkspaceProvider>
            <ErrorBoundary label="Application">
            <Toaster />
      <ConfirmModalProvider />
            <Sonner />
            <BrowserRouter future={{ v7_startTransition: true }}>
              <OfflineGate>
              <ChatbotWidgetLoader />
              <DataProtectionBanner />
              <Routes>
                {/* Public routes */}
                <Route path="/auth" element={<PublicOnly><Auth /></PublicOnly>} />
                <Route path="/auth/callback" element={<LazyPage><SocialCallback /></LazyPage>} />
                <Route path="/invite" element={<LazyPage><InvitePage /></LazyPage>} />
                <Route path="/reset-password" element={<LazyPage><ResetPassword /></LazyPage>} />
                <Route path="/contact/:tenantId" element={<LazyPage><ContactForm /></LazyPage>} />
                <Route path="/privacy" element={<LazyPage><PrivacyPage /></LazyPage>} />
                <Route path="/terms" element={<LazyPage><TermsPage /></LazyPage>} />
                <Route path="/data-deletion" element={<LazyPage><DataDeletionPage /></LazyPage>} />
                <Route path="/download" element={<MobileDownloadPage />} />
                <Route path="/mobile" element={<Navigate to="/download" replace />} />
                <Route path="/" element={<HomeRoute />} />
                <Route path="/home" element={<HomeRoute />} />

                {/* Protected app routes */}
                <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                  <Route path="/dashboard" element={<LazyPage><Index /></LazyPage>} />
                  <Route path="/index" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/social" element={<LazyPage><SocialDashboardPage /></LazyPage>} />
                  <Route path="/social/dashboard" element={<Navigate to="/social" replace />} />
                  <Route path="/brand-brain" element={<LazyPage><BrandBrain /></LazyPage>} />
                  <Route path="/content" element={<LazyPage><ContentEngine /></LazyPage>} />
                  <Route path="/campaigns" element={<LazyPage><CampaignsPage /></LazyPage>} />
                  <Route path="/campaigns/:id" element={<LazyPage><CampaignDetailPage /></LazyPage>} />
                  <Route path="/automations/runs/:runAt" element={<LazyPage><AutomationRunPage /></LazyPage>} />
                  <Route path="/content/edit/:id" element={<LazyPage><EditContent /></LazyPage>} />
                  <Route path="/content/:id" element={<LazyPage><ContentDetailPage /></LazyPage>} />
                  <Route path="/scheduler" element={<LazyPage><Scheduler /></LazyPage>} />
                  <Route path="/leads" element={<LazyPage><LeadAgent /></LazyPage>} />
                  <Route path="/whatsapp" element={<LazyPage><WhatsappHubPage /></LazyPage>} />
                  <Route path="/whatsapp/templates" element={<LazyPage><WhatsappTemplatesPage /></LazyPage>} />
                  <Route path="/whatsapp/bots" element={<LazyPage><WhatsappBotsPage /></LazyPage>} />
                  <Route path="/whatsapp/bots/:id" element={<LazyPage><WhatsappBotBuilderPage /></LazyPage>} />
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
                  <Route path="/mail" element={<LazyPage><MailDashboardPage /></LazyPage>} />
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
            </ThemeProvider>
        </TenantProvider>
      </AuthProvider>
      </BackendStatusProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
