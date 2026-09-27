import { Link } from "react-router-dom";
import {
  Brain, Pen, CalendarClock, MessageSquare, BarChart3, Zap, Settings,
  Rocket, Link2, Image, LayoutTemplate, MessageSquareReply, Megaphone,
  GitPullRequestArrow, Users, ClipboardList, ShieldCheck, Activity,
  ChevronsUpDown, Building2, CreditCard, Download, ListOrdered, Layers, Target, Mail, MessageCircle
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

function NavItem({ title, url, icon: Icon, exact = false, badge, id }: {
  title: string; url: string; icon: React.ComponentType<{ className?: string }>;
  exact?: boolean; badge?: number; id?: string;
}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <SidebarMenuItem id={id}>
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
    <Sidebar collapsible="icon" className="min-h-0" id="tour-dashboard-nav">
      <SidebarHeader className="shrink-0 p-3 border-b border-sidebar-border space-y-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-2 w-full rounded-md hover:bg-sidebar-accent px-1 py-1.5 transition-colors",
                collapsed && "justify-center px-0",
              )}
              title={collapsed ? activeWorkspaceName : undefined}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary shadow-sm">
                <Rocket className="h-4 w-4 text-primary-foreground" />
              </div>
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
        {/* Core */}
        <SidebarGroup id="tour-sidebar-core">
          <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-wider">Core</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem id="tour-nav-dashboard" title="Main Dashboard" url="/dashboard" icon={Zap} exact />
              <NavItem id="tour-nav-social" title="Social Dashboard" url="/social" icon={BarChart3} exact />
              <NavItem id="tour-nav-brand-brain" title="Brand Brain" url="/brand-brain" icon={Brain} />
              <NavItem id="tour-nav-content" title="Content Engine" url="/content" icon={Pen} />
              <NavItem id="tour-nav-campaigns" title="Campaigns" url="/campaigns" icon={Megaphone} />
              <NavItem id="tour-nav-scheduler" title="Scheduler" url="/scheduler" icon={CalendarClock} />
              <NavItem id="tour-nav-publisher" title="Connections" url="/publisher" icon={Link2} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Engagement */}
        <SidebarGroup id="tour-sidebar-engagement">
          <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-wider">Engagement</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem id="tour-nav-leads" title="Leads" url="/leads" icon={MessageSquare} />
              <NavItem id="tour-nav-email" title="Email" url="/mail" icon={Mail} />
              <NavItem id="tour-nav-whatsapp" title="WhatsApp" url="/whatsapp" icon={MessageCircle} />
              <NavItem id="tour-nav-inbox" title="Social Inbox" url="/replies" icon={MessageSquareReply} />
              <NavItem id="tour-nav-analytics" title="Analytics" url="/analytics" icon={BarChart3} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Assets */}
        <SidebarGroup id="tour-sidebar-assets">
          <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-wider">Assets</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem id="tour-nav-media" title="Media" url="/media" icon={Image} />
              <NavItem id="tour-nav-templates" title="Post Templates" url="/templates" icon={LayoutTemplate} />
              <NavItem id="tour-nav-ads" title="Ads" url="/ads" icon={Target} />
              <NavItem id="tour-nav-workspaces" title="Workspaces" url="/workspaces" icon={Building2} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Team & Governance */}
        <SidebarGroup id="tour-sidebar-governance">
          <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-wider">Governance</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem id="tour-nav-approvals" title="Approvals" url="/approvals" icon={GitPullRequestArrow} />
              <NavItem id="tour-nav-team" title="Team" url="/team" icon={Users} />
              <NavItem id="tour-nav-audit" title="Audit Logs" url="/audit" icon={ClipboardList} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* System Admin */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-wider">System Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem id="tour-nav-roles" title="Roles & Permissions" url="/admin/roles" icon={ShieldCheck} />
              <NavItem id="tour-nav-maker-checker" title="Maker-Checker" url="/admin/maker-checker" icon={GitPullRequestArrow} />
              {isSuperAdmin && (
                <>
                  <NavItem id="tour-nav-backoffice" title="Platform Backoffice" url="/admin/backoffice" icon={Activity} />
                  <NavItem id="tour-nav-queues" title="Job Queues" url="/admin/queues" icon={ListOrdered} />
                  <NavItem id="tour-nav-system" title="System Settings" url="/admin/system" icon={Settings} />
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
          
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 w-full rounded-md hover:bg-sidebar-accent px-2 py-1.5 transition-colors text-sidebar-foreground text-sm"
                >
                  <MessageCircle className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="flex-1 text-left font-medium">Help & Tours</span>}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Replay Tours</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {
                  import("@/services/tour.service").then(({ TourService }) => {
                    import("@/pages/Dashboard.tour").then(({ dashboardTourConfig }) => {
                      TourService.startTour('dashboard', dashboardTourConfig.steps, undefined, dashboardTourConfig.driverConfig);
                    });
                  });
                }}>
                  Replay Dashboard Tour
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  import("@/services/tour.service").then(({ TourService }) => {
                    import("@/components/AppSidebar.tour").then(({ appSidebarTourConfig }) => {
                      TourService.startTour('sidebar', appSidebarTourConfig.steps, undefined, appSidebarTourConfig.driverConfig);
                    });
                  });
                }}>
                  Replay Navigation Tour
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  import("@/services/tour.service").then(({ TourService }) => {
                    import("@/pages/ContentEngine.tour").then(({ contentEngineTourConfig }) => {
                      TourService.startTour('content_engine', contentEngineTourConfig.steps, undefined, contentEngineTourConfig.driverConfig);
                    });
                  });
                }}>
                  Replay Content Engine Tour
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  import("@/services/tour.service").then(({ TourService }) => {
                    import("@/pages/Campaigns.tour").then(({ campaignsTourConfig }) => {
                      TourService.startTour('campaigns', campaignsTourConfig.steps, undefined, campaignsTourConfig.driverConfig);
                    });
                  });
                }}>
                  Replay Campaigns Tour
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  import("@/services/tour.service").then(({ TourService }) => {
                    import("@/pages/Scheduler.tour").then(({ schedulerTourConfig }) => {
                      TourService.startTour('scheduler', schedulerTourConfig.steps, undefined, schedulerTourConfig.driverConfig);
                    });
                  });
                }}>
                  Replay Scheduler Tour
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  import("@/services/tour.service").then(({ TourService }) => {
                    import("@/pages/PublisherConnect.tour").then(({ publisherConnectTourConfig }) => {
                      TourService.startTour('connections', publisherConnectTourConfig.steps, undefined, publisherConnectTourConfig.driverConfig);
                    });
                  });
                }}>
                  Replay Connections Tour
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
