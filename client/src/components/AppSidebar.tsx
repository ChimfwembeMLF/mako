import { Link } from "react-router-dom";
import {
  Brain, Pen, CalendarClock, Zap, Settings, Rocket, Link2, Image, LayoutTemplate,
  Megaphone, GitPullRequestArrow, Users, ClipboardList, ShieldCheck, Activity, ChevronsUpDown,
  Building2, CreditCard, Download, ListOrdered, Target, Mail, MessageCircle, LogOut,
  Inbox, UserPlus, LayoutDashboard, LineChart, Workflow,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { P, type PermissionKey } from "@/lib/permissions";
import { useWorkspace } from "@/hooks/useWorkspace";
import { WorkspaceLogo } from "@/components/WorkspaceLogo";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTenant } from "@/hooks/useTenant";
import { cn } from "@/lib/utils";

function NavItem({ title, url, icon: Icon, exact = false, id }: {
  title: string; url: string; icon: React.ComponentType<{ className?: string }>;
  exact?: boolean; id?: string;
}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <SidebarMenuItem id={id}>
      <SidebarMenuButton asChild tooltip={collapsed ? title : undefined}>
        <NavLink to={url} end={exact}
          className="hover:bg-sidebar-accent"
          activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
          <Icon className="mr-2 h-4 w-4 shrink-0" />
          {!collapsed && <span className="flex-1 truncate">{title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

type NavEntry = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  id?: string;
  exact?: boolean;
  /** Shown when the person has any of these permissions. Omit for everyone. */
  perms?: PermissionKey[];
  superAdminOnly?: boolean;
};

type NavGroup = { label: string; id?: string; items: NavEntry[] };

/** Grouped by what people are doing: making content, getting it out, talking to people, measuring, running the team. */
const NAV: NavGroup[] = [
  {
    label: "Home",
    id: "tour-sidebar-core",
    items: [
      { id: "tour-nav-dashboard", title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, exact: true },
      { id: "tour-nav-social", title: "Social overview", url: "/social", icon: Zap, exact: true },
    ],
  },
  {
    label: "Create",
    items: [
      { id: "tour-nav-brand-brain", title: "Brand voice", url: "/brand-brain", icon: Brain },
      { id: "tour-nav-content", title: "Posts", url: "/content", icon: Pen, perms: [P.content.view] },
      { id: "tour-nav-campaigns", title: "Campaigns", url: "/campaigns", icon: Megaphone, perms: [P.content.view] },
      { id: "tour-nav-templates", title: "Templates", url: "/templates", icon: LayoutTemplate, perms: [P.templates.view] },
      { id: "tour-nav-media", title: "Media", url: "/media", icon: Image, perms: [P.media.view] },
    ],
  },
  {
    label: "Publish",
    items: [
      { id: "tour-nav-scheduler", title: "Schedule", url: "/scheduler", icon: CalendarClock, perms: [P.content.view] },
      { id: "tour-nav-approvals", title: "Approvals", url: "/approvals", icon: GitPullRequestArrow, perms: [P.approvals.view, P.content.approve] },
      { id: "tour-nav-publisher", title: "Social accounts", url: "/publisher", icon: Link2 },
    ],
  },
  {
    label: "Engage",
    id: "tour-sidebar-engagement",
    items: [
      { id: "tour-nav-inbox", title: "Inbox", url: "/replies", icon: Inbox, perms: [P.replies.view] },
      { id: "tour-nav-leads", title: "Leads", url: "/leads", icon: UserPlus, perms: [P.leads.view] },
      { id: "tour-nav-email", title: "Email", url: "/mail", icon: Mail, perms: [P.leads.email, P.leads.view] },
      { id: "tour-nav-whatsapp", title: "WhatsApp", url: "/whatsapp", icon: MessageCircle },
    ],
  },
  {
    label: "Grow",
    id: "tour-sidebar-assets",
    items: [
      { id: "tour-nav-analytics", title: "Analytics", url: "/analytics", icon: LineChart, perms: [P.analytics.view] },
      { id: "tour-nav-ads", title: "Ads", url: "/ads", icon: Target },
    ],
  },
  {
    label: "Team",
    id: "tour-sidebar-governance",
    items: [
      { id: "tour-nav-team", title: "Members", url: "/team", icon: Users, perms: [P.team.view] },
      { id: "tour-nav-workspaces", title: "Workspaces", url: "/workspaces", icon: Building2 },
      { id: "tour-nav-audit", title: "Audit logs", url: "/audit", icon: ClipboardList, perms: [P.audit.view] },
      { title: "Export data", url: "/export", icon: Download, perms: [P.settings.view] },
    ],
  },
  {
    label: "Admin",
    items: [
      { id: "tour-nav-roles", title: "Roles & permissions", url: "/admin/roles", icon: ShieldCheck, perms: [P.admin.roles] },
      { id: "tour-nav-maker-checker", title: "Maker-checker", url: "/admin/maker-checker", icon: Workflow, perms: [P.admin.makerChecker] },
      { id: "tour-nav-backoffice", title: "Platform backoffice", url: "/admin/backoffice", icon: Activity, superAdminOnly: true },
      { id: "tour-nav-queues", title: "Job queues", url: "/admin/queues", icon: ListOrdered, superAdminOnly: true },
      { id: "tour-nav-system", title: "System settings", url: "/admin/system", icon: Settings, superAdminOnly: true },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { tenant, tenants, switchTenant } = useTenant();
  const { isSuperAdmin, canAny, loading: permsLoading } = usePermissions();
  // While permissions load, show everything rather than flashing a short menu.
  const visible = (item: NavEntry) =>
    item.superAdminOnly ? isSuperAdmin : !item.perms || permsLoading || isSuperAdmin || canAny(...item.perms);
  const { signOut } = useAuth();
  const { workspaces, activeWorkspace, setActiveWorkspace, loading: workspacesLoading } = useWorkspace();
  const activeWorkspaceRow = workspaces.find((w) => w.id === activeWorkspace);
  const activeWorkspaceName = activeWorkspaceRow?.name ?? "Workspace";

  return (
    <Sidebar collapsible="icon" className="min-h-0" id="tour-dashboard-nav">
      <SidebarHeader className="h-[65px] shrink-0 justify-center px-3 py-0 border-b border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-2 w-full rounded-md hover:bg-sidebar-accent px-1 py-1.5 transition-colors",
                collapsed && "justify-center px-0",
              )}
              title={collapsed ? activeWorkspaceName : undefined}
            >
              <WorkspaceLogo
                name={activeWorkspaceName}
                logoUrl={activeWorkspaceRow?.logoUrl}
                className="h-8 w-8 rounded-md shadow-sm"
                fallback={<Rocket className="h-4 w-4" />}
              />
              {!collapsed && (
                <>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest truncate">{tenant?.name ?? "Mako"}</p>
                    <p className="text-xs font-semibold truncate text-sidebar-foreground">
                      {workspacesLoading ? "Loading…" : activeWorkspaceName}
                    </p>
                  </div>
                  <ChevronsUpDown className="h-3.5 w-3.5 text-sidebar-foreground/40 shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Workspaces
            </DropdownMenuLabel>
            {workspaces.length === 0 ? (
              <DropdownMenuItem asChild className="text-xs">
                <Link to="/workspaces">Create a workspace</Link>
              </DropdownMenuItem>
            ) : (
              workspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => setActiveWorkspace(ws.id)}
                  className={cn("text-xs", ws.id === activeWorkspace && "font-semibold")}
                >
                  <WorkspaceLogo
                    name={ws.name}
                    logoUrl={ws.logoUrl}
                    className="mr-2 h-5 w-5 rounded text-[9px]"
                    fallbackClassName="bg-muted text-muted-foreground"
                  />
                  <span className="truncate">{ws.name}</span>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="text-xs">
              <Link to="/workspaces">Manage workspaces</Link>
            </DropdownMenuItem>
            
            {tenants.length > 1 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Organizations
                </DropdownMenuLabel>
                {tenants.map(t => (
                  <DropdownMenuItem key={t.id} onClick={() => switchTenant(t.id)}
                    className={cn("text-xs", t.id === tenant?.id && "font-semibold")}>
                    <Building2 className="h-3.5 w-3.5 mr-2 shrink-0" />
                    <span className="truncate">{t.name}</span>
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {NAV.map((group) => {
          const items = group.items.filter(visible);
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={group.label} id={group.id}>
              <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-wider">{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <NavItem key={item.url} id={item.id} title={item.title} url={item.url} icon={item.icon} exact={item.exact} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="shrink-0 border-t border-sidebar-border">
        <SidebarMenu>
          {visible({ title: "Billing", url: "/billing", icon: CreditCard, perms: [P.settings.billing] }) && (
            <NavItem title="Billing" url="/billing" icon={CreditCard} />
          )}
          <NavItem title="Settings" url="/settings" icon={Settings} />
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Sign out" className="hover:bg-sidebar-accent" onClick={() => void signOut()}>
              <LogOut className="mr-2 h-4 w-4 shrink-0" />
              {!collapsed && <span className="flex-1">Sign out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
