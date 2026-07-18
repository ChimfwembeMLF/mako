import {
  Brain, Pen, CalendarClock, MessageSquare, BarChart3, Zap, Settings, Bot,
  Link2, Image, LayoutTemplate, MessageSquareReply,
  GitPullRequestArrow, Users, ClipboardList, ShieldCheck,
  Building2, CreditCard, Download, Activity, History, Mail,
  Megaphone, BookOpen, Target, MessageCircle,
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
    label: "Create",
    items: [
      { title: "Brand Brain", url: "/brand-brain", icon: Brain, description: "Voice, audience & guidelines", keywords: "brand voice identity audience profile" },
      { title: "Content Engine", url: "/content", icon: Pen, description: "Write and generate posts", keywords: "create posts generate content write" },
      { title: "Campaigns", url: "/campaigns", icon: Megaphone, description: "Plan multi-post campaigns", keywords: "campaign series posts plan narrative" },
      { title: "Scheduler", url: "/scheduler", icon: CalendarClock, description: "Calendar, queue & publish", keywords: "schedule publish calendar queue" },
      { title: "Connections", url: "/publisher", icon: Link2, description: "Link social & ad accounts", keywords: "connect social oauth linkedin meta publisher channels" },
    ],
  },
  {
    label: "Inbox",
    items: [
      { title: "Leads", url: "/leads", icon: MessageSquare, description: "Qualify and respond to inbound leads", keywords: "leads inbox qualify contacts whatsapp lead agent" },
      { title: "Email", url: "/mail", icon: Mail, description: "Gmail inbox, drafts & auto-replies", keywords: "gmail email connect send mail inbox" },
      { title: "Social Inbox", url: "/replies", icon: MessageSquareReply, description: "Comments, DMs & WhatsApp chats", keywords: "comments auto reply rules inbox replies social" },
      { title: "Chatbot", url: "/chatbot", icon: Bot, description: "AI assistant & embed widget", permission: P.chatbot.view, keywords: "chatbot widget assistant ai" },
      { title: "Chat History", url: "/chatbot/sessions", icon: History, description: "Widget & playground transcripts", permission: P.chatbot.view, keywords: "chat sessions transcripts history conversations log" },
      { title: "Knowledge", url: "/chatbot/knowledge", icon: BookOpen, description: "Documents for chatbot RAG", permission: P.chatbot.view, keywords: "knowledge base documents rag training chatbot" },
      { title: "WhatsApp", url: "/whatsapp", icon: MessageCircle, description: "Connect, menu bot, templates & messaging", keywords: "whatsapp connect webhook menu bot flows inbox templates hsm" },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Analytics", url: "/analytics", icon: BarChart3, description: "Performance insights", keywords: "analytics metrics stats performance" },
      { title: "Reports", url: "/reports", icon: ClipboardList, description: "On-demand insights", keywords: "reports export insights" },
    ],
  },
  {
    label: "Library",
    items: [
      { title: "Media", url: "/media", icon: Image, description: "Images & assets", keywords: "media images assets upload library" },
      { title: "Post Templates", url: "/templates", icon: LayoutTemplate, description: "Reusable post copy", keywords: "templates reusable content post" },
    ],
  },
  {
    label: "Grow",
    items: [
      { title: "Ads", url: "/ads", icon: Target, description: "Paid ad campaigns", keywords: "ads meta google advertising paid" },
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
  { title: "Workspaces", url: "/workspaces", icon: Building2, description: "Organize by brand", keywords: "workspaces brands organizations" },
  { title: "Approvals", url: "/approvals", icon: GitPullRequestArrow, permission: P.approvals.view, keywords: "approvals workflow review" },
  { title: "Team", url: "/team", icon: Users, permission: P.team.view, keywords: "team members invite roles" },
  { title: "Audit Logs", url: "/audit", icon: ClipboardList, permission: P.audit.view, keywords: "audit logs activity history" },
  { title: "Roles & Permissions", url: "/admin/roles", icon: ShieldCheck, permission: P.admin.roles, keywords: "roles permissions rbac admin" },
  { title: "Maker-Checker", url: "/admin/maker-checker", icon: GitPullRequestArrow, permission: P.admin.makerChecker, keywords: "maker checker approval admin" },
  { title: "Platform Backoffice", url: "/admin/backoffice", icon: Activity, superAdmin: true, keywords: "backoffice super admin platform" },
  { title: "Job Queues", url: "/admin/queues", icon: Activity, superAdmin: true, keywords: "queues jobs admin" },
  { title: "System Settings", url: "/admin/system", icon: Settings, superAdmin: true, keywords: "system settings admin theme" },
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

export function filterNavGroups(
  groups: NavGroup[],
  canAny: (...perms: PermissionKey[]) => boolean,
  isSuperAdmin: boolean,
  loading: boolean,
): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: filterNavItems(group.items, canAny, isSuperAdmin, loading),
    }))
    .filter((group) => group.items.length > 0);
}

export function allNavItems(
  canAny: (...perms: PermissionKey[]) => boolean,
  isSuperAdmin: boolean,
  loading: boolean,
): NavItem[] {
  const visibleMore = filterNavItems(MORE_ITEMS, canAny, isSuperAdmin, loading);
  const groups = filterNavGroups(NAV_GROUPS, canAny, isSuperAdmin, loading).flatMap((g) => g.items);
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
