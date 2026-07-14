import {
  Brain, Pen, CalendarClock, MessageSquare, BarChart3, Zap, Settings, Bot,
  Link2, Image, LayoutTemplate, MessageSquareReply,
  GitPullRequestArrow, Users, ClipboardList, ShieldCheck,
  Building2, CreditCard, Download, Activity, History, Mail,
} from "lucide-react";
import { P, type PermissionKey } from "@/lib/permissions";

export type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  keywords?: string;
  permission?: PermissionKey | PermissionKey[];
  superAdmin?: boolean;
};

export type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Studio",
    items: [
      { title: "Brand Brain", url: "/brand-brain", icon: Brain, description: "Identity, voice & audience", keywords: "brand voice identity audience profile" },
      { title: "Content Engine", url: "/content", icon: Pen, description: "Generate on-brand content", keywords: "create posts generate content write" },
      { title: "Scheduler", url: "/scheduler", icon: CalendarClock, description: "Plan & publish posts", keywords: "schedule publish calendar queue" },
      { title: "Publisher", url: "/publisher", icon: Link2, description: "Connect social accounts", keywords: "connect social oauth linkedin meta" },
    ],
  },
  {
    label: "Engage",
    items: [
      { title: "Lead Agent", url: "/leads", icon: MessageSquare, description: "Qualify & reply to leads", keywords: "leads inbox qualify contacts" },
      { title: "Mail", url: "/mail", icon: Mail, description: "Gmail & email auto-replies", keywords: "gmail email connect send mail" },
      { title: "Replies", url: "/replies", icon: MessageSquareReply, description: "Auto-reply rules", keywords: "comments auto reply rules" },
      { title: "Chatbot", url: "/chatbot", icon: Bot, description: "AI assistant & widget", permission: P.chatbot.view, keywords: "chatbot widget assistant rag" },
      { title: "Conversation Log", url: "/chatbot/sessions", icon: History, description: "Widget & playground transcripts", permission: P.chatbot.view, keywords: "chat sessions transcripts history" },
      { title: "Analytics", url: "/analytics", icon: BarChart3, description: "Performance insights", keywords: "analytics metrics stats performance" },
      { title: "Reports", url: "/reports", icon: ClipboardList, description: "On-demand insights", keywords: "reports export insights" },
    ],
  },
  {
    label: "Library",
    items: [
      { title: "Media Library", url: "/media", icon: Image, description: "Images & assets", keywords: "media images assets upload library" },
      { title: "Templates", url: "/templates", icon: LayoutTemplate, description: "Reusable content", keywords: "templates reusable content" },
      { title: "Workspaces", url: "/workspaces", icon: Building2, description: "Organize by brand", keywords: "workspaces brands organizations" },
    ],
  },
];

export const DASHBOARD_NAV: NavItem = {
  title: "Dashboard",
  url: "/dashboard",
  icon: Zap,
  description: "Overview & quick actions",
  keywords: "home dashboard overview",
};

export const MORE_ITEMS: NavItem[] = [
  { title: "Approvals", url: "/approvals", icon: GitPullRequestArrow, permission: P.approvals.view, keywords: "approvals workflow review" },
  { title: "Team", url: "/team", icon: Users, permission: P.team.view, keywords: "team members invite roles" },
  { title: "Audit Logs", url: "/audit", icon: ClipboardList, permission: P.audit.view, keywords: "audit logs activity history" },
  { title: "Roles & Permissions", url: "/admin/roles", icon: ShieldCheck, permission: P.admin.roles, keywords: "roles permissions rbac admin" },
  { title: "Maker-Checker", url: "/admin/maker-checker", icon: GitPullRequestArrow, permission: P.admin.makerChecker, keywords: "maker checker approval admin" },
  { title: "Platform Backoffice", url: "/admin/backoffice", icon: Activity, superAdmin: true, keywords: "backoffice super admin platform" },
  { title: "Job Queues", url: "/admin/queues", icon: Activity, superAdmin: true, keywords: "queues jobs admin" },
  { title: "System Settings", url: "/admin/system", icon: Settings, superAdmin: true, keywords: "system settings admin" },
  { title: "Export Data", url: "/export", icon: Download, permission: P.leads.export, keywords: "export download data csv" },
  { title: "Billing", url: "/billing", icon: CreditCard, permission: P.settings.billing, keywords: "billing subscription payment plan" },
  { title: "Settings", url: "/settings", icon: Settings, permission: P.settings.view, keywords: "settings preferences account" },
];

export function filterNavItems(
  items: NavItem[],
  canAny: (...perms: PermissionKey[]) => boolean,
  isSuperAdmin: boolean,
  loading: boolean,
): NavItem[] {
  if (loading) return [];
  return items.filter((item) => {
    if (item.superAdmin) return isSuperAdmin;
    if (!item.permission) return true;
    const perms = Array.isArray(item.permission) ? item.permission : [item.permission];
    return canAny(...perms);
  });
}

export function allNavItems(
  canAny: (...perms: PermissionKey[]) => boolean,
  isSuperAdmin: boolean,
  loading: boolean,
): NavItem[] {
  const visibleMore = filterNavItems(MORE_ITEMS, canAny, isSuperAdmin, loading);
  const groups = NAV_GROUPS.flatMap((g) => filterNavItems(g.items, canAny, isSuperAdmin, loading));
  return [DASHBOARD_NAV, ...groups, ...visibleMore];
}

export function matchNavItems(items: NavItem[], query: string): NavItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items.slice(0, 8);
  return items.filter((item) => {
    const hay = `${item.title} ${item.description ?? ""} ${item.keywords ?? ""}`.toLowerCase();
    return q.split(/\s+/).some((word) => word.length > 1 && hay.includes(word));
  });
}
