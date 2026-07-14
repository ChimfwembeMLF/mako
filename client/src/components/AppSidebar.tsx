import { Link } from "react-router-dom";
import {
  Brain, Pen, CalendarClock, MessageSquare, BarChart3, Zap, Settings,
  Rocket, Link2, Image, LayoutTemplate, MessageSquareReply, Megaphone,
  GitPullRequestArrow, Users, ClipboardList, ShieldCheck, Activity,
  ChevronsUpDown, Building2, CreditCard, Download, ListOrdered, Layers, Target, FileText, Mail
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/usePermissions";
import { useWorkspace } from "@/hooks/useWorkspace";
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

function NavItem({ title, url, icon: Icon, exact = false, badge }: {
  title: string; url: string; icon: React.ComponentType<{ className?: string }>;
  exact?: boolean; badge?: number;
}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <NavLink to={url} end={exact}
          className="hover:bg-sidebar-accent"
          activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
          <Icon className="mr-2 h-4 w-4 shrink-0" />
          {!collapsed && (
            <span className="flex-1 flex items-center justify-between">
              {title}
              {badge ? <Badge variant="destructive" className="text-[9px] h-4 px-1">{badge}</Badge> : null}
            </span>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { tenant, tenants, switchTenant } = useTenant();
  const { isSuperAdmin } = usePermissions();
  const { workspaces, activeWorkspace, setActiveWorkspace, loading: workspacesLoading } = useWorkspace();
  const activeWorkspaceName =
    workspaces.find((w: { id: string }) => w.id === activeWorkspace)?.name ?? "Workspace";

  return (
    <Sidebar collapsible="icon" className="min-h-0">
      <SidebarHeader className="shrink-0 p-3 border-b border-sidebar-border space-y-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 w-full rounded-md hover:bg-sidebar-accent px-1 py-1.5 transition-colors">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md gradient-primary">
                <Rocket className="h-4 w-4 text-primary-foreground" />
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-xs font-semibold truncate text-sidebar-foreground">{tenant?.name ?? "Mako "}</p>
                    <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">Marketing AI</p>
                  </div>
                  <ChevronsUpDown className="h-3.5 w-3.5 text-sidebar-foreground/40" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          {tenants.length > 1 && (
            <DropdownMenuContent align="start" className="w-48">
              {tenants.map(t => (
                <DropdownMenuItem key={t.id} onClick={() => switchTenant(t.id)}
                  className={`text-xs ${t.id === tenant?.id ? 'font-semibold' : ''}`}>
                  <Building2 className="h-3.5 w-3.5 mr-2" />
                  {t.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          )}
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-2 w-full rounded-md hover:bg-sidebar-accent px-1 py-1.5 transition-colors",
                collapsed && "justify-center px-0",
              )}
              title={collapsed ? activeWorkspaceName : undefined}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-accent">
                <Layers className="h-3.5 w-3.5 text-sidebar-foreground/80" />
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">Workspace</p>
                    <p className="text-xs font-medium truncate text-sidebar-foreground">
                      {workspacesLoading ? "Loading…" : activeWorkspaceName}
                    </p>
                  </div>
                  {workspaces.length > 0 && (
                    <ChevronsUpDown className="h-3.5 w-3.5 text-sidebar-foreground/40 shrink-0" />
                  )}
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Switch workspace
            </DropdownMenuLabel>
            {workspaces.length === 0 ? (
              <DropdownMenuItem asChild className="text-xs">
                <Link to="/workspaces">Create a workspace</Link>
              </DropdownMenuItem>
            ) : (
              workspaces.map((ws: { id: string; name: string }) => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => setActiveWorkspace(ws.id)}
                  className={cn("text-xs", ws.id === activeWorkspace && "font-semibold")}
                >
                  <Layers className="h-3.5 w-3.5 mr-2 shrink-0" />
                  <span className="truncate">{ws.name}</span>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="text-xs">
              <Link to="/workspaces">Manage workspaces</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {/* Core */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-wider">Core</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem title="Dashboard" url="/dashboard" icon={Zap} exact />
              <NavItem title="Brand Brain" url="/brand-brain" icon={Brain} />
              <NavItem title="Content Engine" url="/content" icon={Pen} />
              <NavItem title="AI Campaigns" url="/campaigns" icon={Megaphone} />
              <NavItem title="Scheduler" url="/scheduler" icon={CalendarClock} />
              <NavItem title="Publisher" url="/publisher" icon={Link2} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Engagement */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-wider">Engagement</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem title="Lead Agent" url="/leads" icon={MessageSquare} />
              <NavItem title="Mail" url="/mail" icon={Mail} />
              <NavItem title="WA Templates" url="/whatsapp/templates" icon={FileText} />
              <NavItem title="Replies" url="/replies" icon={MessageSquareReply} />
              <NavItem title="Analytics" url="/analytics" icon={BarChart3} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Assets */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-wider">Assets</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem title="Media Library" url="/media" icon={Image} />
              <NavItem title="Templates" url="/templates" icon={LayoutTemplate} />
              <NavItem title="Ad Campaigns" url="/ads" icon={Target} />
              <NavItem title="Workspaces" url="/workspaces" icon={Building2} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Team & Governance */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-wider">Governance</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem title="Approvals" url="/approvals" icon={GitPullRequestArrow} />
              <NavItem title="Team" url="/team" icon={Users} />
              <NavItem title="Audit Logs" url="/audit" icon={ClipboardList} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* System Admin */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-wider">System Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem title="Roles & Permissions" url="/admin/roles" icon={ShieldCheck} />
              <NavItem title="Maker-Checker" url="/admin/maker-checker" icon={GitPullRequestArrow} />
              {isSuperAdmin && (
                <>
                  <NavItem title="Platform Backoffice" url="/admin/backoffice" icon={Activity} />
                  <NavItem title="Job Queues" url="/admin/queues" icon={ListOrdered} />
                  <NavItem title="System Settings" url="/admin/system" icon={Settings} />
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="shrink-0 border-t border-sidebar-border">
        <SidebarMenu>
          <NavItem title="Export Data" url="/export" icon={Download} />
          <NavItem title="Billing" url="/billing" icon={CreditCard} />
          <NavItem title="Settings" url="/settings" icon={Settings} />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
