import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Link, useLocation, useMatch } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Brain, Pen, CalendarClock, Zap, Settings, Rocket, Link2, Image, LayoutTemplate,
  Megaphone, GitPullRequestArrow, Users, ClipboardList, ShieldCheck, Activity, ChevronsUpDown,
  Building2, Download, ListOrdered, Target, Mail, MessageCircle, LogOut,
  Inbox, UserPlus, LayoutDashboard, LineChart, Workflow, Check, ChevronRight, PanelLeftClose, PanelLeftOpen,
  Search, X, Sun, Moon, Monitor,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { P, type PermissionKey } from "@/lib/permissions";
import { useWorkspace } from "@/hooks/useWorkspace";
import { WorkspaceLogo } from "@/components/WorkspaceLogo";
import { approvalRequestsApi, inboxApi } from "@/lib/api";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useTheme, type ColorMode } from "@/hooks/useTheme";
import { useTenant } from "@/hooks/useTenant";
import { cn } from "@/lib/utils";

type Icon = React.ComponentType<{ className?: string }>;

type NavEntry = {
  title: string;
  url: string;
  icon: Icon;
  id?: string;
  exact?: boolean;
  /** Shown when the person has any of these permissions. Omit for everyone. */
  perms?: PermissionKey[];
  superAdminOnly?: boolean;
  /** A live count shown beside the item. */
  badge?: "inbox" | "approvals";
};

type NavGroup = {
  label?: string;
  id?: string;
  items: NavEntry[];
  /** Folded away until opened, or until you are on one of its pages. */
  collapsible?: boolean;
};

/** Grouped by what people are doing: making content, getting it out, talking to people, measuring, running the team. */
const NAV: NavGroup[] = [
  {
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
      { id: "tour-nav-approvals", title: "Approvals", url: "/approvals", icon: GitPullRequestArrow, perms: [P.approvals.view, P.content.approve], badge: "approvals" },
      { id: "tour-nav-publisher", title: "Social accounts", url: "/publisher", icon: Link2 },
    ],
  },
  {
    label: "Engage",
    id: "tour-sidebar-engagement",
    items: [
      { id: "tour-nav-inbox", title: "Inbox", url: "/replies", icon: Inbox, perms: [P.replies.view], badge: "inbox" },
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
    label: "Manage",
    id: "tour-sidebar-governance",
    collapsible: true,
    items: [
      { id: "tour-nav-team", title: "Members", url: "/team", icon: Users, perms: [P.team.view] },
      { id: "tour-nav-workspaces", title: "Workspaces", url: "/workspaces", icon: Building2 },
      { id: "tour-nav-audit", title: "Audit logs", url: "/audit", icon: ClipboardList, perms: [P.audit.view] },
      { title: "Export data", url: "/export", icon: Download, perms: [P.settings.view] },
      { id: "tour-nav-roles", title: "Roles & permissions", url: "/admin/roles", icon: ShieldCheck, perms: [P.admin.roles] },
      { id: "tour-nav-maker-checker", title: "Maker-checker", url: "/admin/maker-checker", icon: Workflow, perms: [P.admin.makerChecker] },
      { id: "tour-nav-backoffice", title: "Platform backoffice", url: "/admin/backoffice", icon: Activity, superAdminOnly: true },
      { id: "tour-nav-queues", title: "Job queues", url: "/admin/queues", icon: ListOrdered, superAdminOnly: true },
      { id: "tour-nav-system", title: "System settings", url: "/admin/system", icon: Settings, superAdminOnly: true },
    ],
  },
];

const MANAGE_OPEN_KEY = "mako_sidebar_manage_open";

/** Where the nav is drawn: the desktop sidebar, or the phone and tablet menu (bigger rows, closes on tap). */
const NavSurface = createContext<{ sheet: boolean; onNavigate?: () => void }>({ sheet: false });

/** Unread conversations and pending approvals, refreshed every couple of minutes. */
function useSidebarCounts(enabled: { inbox: boolean; approvals: boolean }) {
  const { tenant } = useTenant();
  const { activeWorkspace } = useWorkspace();
  const tenantId = tenant?.id;
  const inbox = useQuery({
    queryKey: ["sidebar-count", "inbox", tenantId, activeWorkspace],
    queryFn: async () => {
      const rows = await inboxApi.conversations(tenantId!, "all", activeWorkspace || undefined);
      return rows.filter((c) => c.unreadCount > 0).length;
    },
    enabled: Boolean(tenantId) && enabled.inbox,
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: false,
  });
  const approvals = useQuery({
    queryKey: ["sidebar-count", "approvals", tenantId],
    queryFn: async () => (await approvalRequestsApi.findAll({ tenantId, status: "pending" })).length,
    enabled: Boolean(tenantId) && enabled.approvals,
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: false,
  });
  return { inbox: inbox.data ?? 0, approvals: approvals.data ?? 0 };
}

function CountBadge({ count, collapsed }: { count: number; collapsed: boolean }) {
  if (count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  if (collapsed) {
    return <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-sidebar" aria-hidden />;
  }
  return (
    <span className="ml-auto min-w-5 rounded-full bg-primary/15 px-1.5 text-center text-[11px] font-semibold leading-5 tabular-nums text-foreground">
      {label}
    </span>
  );
}

/**
 * The curved branch from a group's label to one of its items. A vertical line carries on
 * to the next item, so each group reads as a small tree. The current page's branch is orange.
 */
function TreeBranch({ active, last }: { active: boolean; last: boolean }) {
  return (
    <>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-[11px] -top-1 h-[calc(50%+4px)] w-2.5 rounded-bl-[10px] border-b border-l transition-colors",
          active ? "z-[1] border-primary" : "border-sidebar-border",
        )}
      />
      {/* Starts where the curve begins (its 10px radius above the middle), so the line never breaks. */}
      {!last && (
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-1 left-[11px] top-[calc(50%-10px)] border-l border-sidebar-border"
        />
      )}
    </>
  );
}

function NavItem({ item, count = 0, tree = false, last = false }: {
  item: NavEntry; count?: number;
  /** Draw curved connector lines (items under a group label). */
  tree?: boolean;
  last?: boolean;
}) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const surface = useContext(NavSurface);
  const collapsed = !surface.sheet && state === "collapsed" && !isMobile;
  const active = Boolean(useMatch({ path: item.url, end: Boolean(item.exact) }));
  const showTree = tree && !collapsed;
  const Icon = item.icon;
  const tooltip = count > 0 ? `${item.title} (${count})` : item.title;
  return (
    <SidebarMenuItem id={item.id} className={cn(showTree && "pl-5")}>
      {showTree && <TreeBranch active={active} last={last} />}
      <SidebarMenuButton
        asChild
        tooltip={collapsed ? tooltip : undefined}
        className={cn("relative rounded-lg", surface.sheet ? "h-11 gap-3 rounded-xl px-3" : "h-8")}
      >
        <NavLink
          to={item.url}
          end={item.exact}
          onClick={() => {
            if (surface.onNavigate) surface.onNavigate();
            else if (isMobile) setOpenMobile(false);
          }}
          aria-label={count > 0 ? `${item.title}, ${count} waiting` : undefined}
          className={cn(
            surface.sheet ? "text-sm" : "text-[13px]",
            "group/nav text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            // Items outside a group mark the current page with a short bar; grouped items use their orange branch.
            !showTree &&
              !surface.sheet &&
              "before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-transparent",
          )}
          activeClassName={cn(
            "bg-primary/10 font-medium !text-sidebar-foreground [&_svg]:!text-primary hover:bg-primary/15",
            !showTree && "before:!bg-primary",
          )}
        >
          <Icon className="h-4 w-4 shrink-0 text-sidebar-foreground/55 transition-colors group-hover/nav:text-sidebar-foreground" />
          {!collapsed && <span className="truncate">{item.title}</span>}
          <CountBadge count={count} collapsed={collapsed} />
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const { tenant, tenants, switchTenant } = useTenant();
  const { workspaces, activeWorkspace, setActiveWorkspace, loading } = useWorkspace();
  const active = workspaces.find((w) => w.id === activeWorkspace);
  const name = active?.name ?? "Workspace";
  const { sheet, onNavigate } = useContext(NavSurface);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            collapsed && "justify-center px-0",
            sheet && "min-h-12",
          )}
          title={collapsed ? name : undefined}
          aria-label={`Workspace: ${name}. Switch workspace`}
        >
          <WorkspaceLogo
            name={name}
            logoUrl={active?.logoUrl}
            className={cn("shrink-0 rounded-lg shadow-sm", sheet ? "h-9 w-9" : "h-8 w-8")}
            fallback={<Rocket className="h-4 w-4" />}
          />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span
                  className={cn("block truncate font-semibold text-sidebar-foreground", sheet ? "text-sm" : "text-[13px]")}
                >
                  {loading ? "Loading…" : name}
                </span>
                {/* The organisation, unless it has the same name as the workspace. */}
                {tenant?.name && tenant.name !== name && (
                  <span className="block truncate text-[11px] text-sidebar-foreground/55">{tenant.name}</span>
                )}
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/40" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={cn(sheet ? "w-[min(18rem,calc(100vw-4rem))]" : "w-60")}>
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Workspaces</DropdownMenuLabel>
        {workspaces.length === 0 ? (
          <DropdownMenuItem asChild className="text-sm">
            <Link to="/workspaces" onClick={onNavigate}>
              Create a workspace
            </Link>
          </DropdownMenuItem>
        ) : (
          workspaces.map((ws) => (
            <DropdownMenuItem key={ws.id} onClick={() => setActiveWorkspace(ws.id)} className="gap-2 text-sm">
              <WorkspaceLogo
                name={ws.name}
                logoUrl={ws.logoUrl}
                className="h-6 w-6 rounded-md text-[10px]"
                fallbackClassName="bg-muted text-muted-foreground"
              />
              <span className="flex-1 truncate">{ws.name}</span>
              {ws.id === activeWorkspace && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="text-sm">
          <Link to="/workspaces" onClick={onNavigate}>
            Manage workspaces
          </Link>
        </DropdownMenuItem>
        {tenants.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Organizations</DropdownMenuLabel>
            {tenants.map((t) => (
              <DropdownMenuItem key={t.id} onClick={() => switchTenant(t.id)} className="gap-2 text-sm">
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{t.name}</span>
                {t.id === tenant?.id && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarUser({ collapsed }: { collapsed: boolean }) {
  const { user, signOut } = useAuth();
  const { toggleSidebar, isMobile } = useSidebar();
  const name = user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user?.email ?? "Account";
  const initial = (user?.firstName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();

  const iconButton = (label: string, Icon: Icon, onClick: () => void, extra?: string) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            extra,
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={collapsed ? "right" : "top"}>{label}</TooltipContent>
    </Tooltip>
  );

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1">
        {iconButton("Expand sidebar", PanelLeftOpen, toggleSidebar)}
        {iconButton("Sign out", LogOut, () => void signOut())}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Link
        to="/settings"
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        title="Your settings"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initial}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium text-sidebar-foreground">{name}</span>
          {user?.email && name !== user.email && (
            <span className="block truncate text-[11px] text-sidebar-foreground/55">{user.email}</span>
          )}
        </span>
      </Link>
      {iconButton("Sign out", LogOut, () => void signOut())}
      {!isMobile && iconButton("Collapse sidebar", PanelLeftClose, toggleSidebar)}
    </div>
  );
}

/** The grouped page list, shared by the desktop sidebar and the phone menu. */
function NavGroups({ collapsed }: { collapsed: boolean }) {
  const { sheet } = useContext(NavSurface);
  const { pathname } = useLocation();
  const { isSuperAdmin, canAny, loading: permsLoading } = usePermissions();
  // While permissions load, show everything rather than flashing a short menu.
  const visible = (item: NavEntry) =>
    item.superAdminOnly ? isSuperAdmin : !item.perms || permsLoading || isSuperAdmin || canAny(...item.perms);

  const counts = useSidebarCounts({
    inbox: !permsLoading && (isSuperAdmin || canAny(P.replies.view)),
    approvals: !permsLoading && (isSuperAdmin || canAny(P.approvals.view, P.content.approve)),
  });

  const [manageOpen, setManageOpen] = useState(() => {
    try {
      return localStorage.getItem(MANAGE_OPEN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggleManage = () =>
    setManageOpen((open) => {
      try {
        localStorage.setItem(MANAGE_OPEN_KEY, open ? "0" : "1");
      } catch {
        /* the toggle still works for this visit */
      }
      return !open;
    });

  return (
    <>
      {NAV.map((group) => {
        const items = group.items.filter(visible);
        if (items.length === 0) return null;
        const onGroupPage = items.some((i) => pathname === i.url || pathname.startsWith(`${i.url}/`));
        const open = !group.collapsible || collapsed || manageOpen || onGroupPage;
        const labelClass = sheet ? "h-8 px-3 text-xs" : "h-7 px-2 text-[11px]";

        return (
          <SidebarGroup
            key={group.label ?? "home"}
            id={sheet ? undefined : group.id}
            className={sheet ? "px-3 py-1.5" : "px-2 py-1"}
          >
            {group.label && !collapsed &&
              (group.collapsible ? (
                <button
                  type="button"
                  onClick={toggleManage}
                  aria-expanded={open}
                  className={cn(
                    "flex w-full items-center gap-1 rounded-md font-medium text-sidebar-foreground/45 transition-colors hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                    labelClass,
                  )}
                >
                  {group.label}
                  <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
                </button>
              ) : (
                <SidebarGroupLabel
                  className={cn("font-medium normal-case tracking-normal text-sidebar-foreground/45", labelClass)}
                >
                  {group.label}
                </SidebarGroupLabel>
              ))}
            {collapsed && group.label && <div className="mx-auto my-1 h-px w-5 bg-sidebar-border" aria-hidden />}
            {open && (
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {items.map((item, i) => (
                    <NavItem
                      key={item.url}
                      item={item}
                      count={item.badge ? counts[item.badge] : 0}
                      tree={Boolean(group.label)}
                      last={i === items.length - 1}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>
        );
      })}
    </>
  );
}

export function AppSidebar() {
  const { state, isMobile, setOpen } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  // Tablets: keep to an icon rail so the page keeps its width (the top bar's menu has the full list).
  useEffect(() => {
    const mq = window.matchMedia?.("(min-width: 768px) and (max-width: 1023px)");
    if (!mq) return;
    const apply = () => mq.matches && setOpen(false);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, [setOpen]);

  return (
    <Sidebar collapsible="icon" className="min-h-0" id="tour-dashboard-nav">
      <SidebarHeader className="h-[65px] shrink-0 justify-center border-b border-sidebar-border px-2 py-0">
        <WorkspaceSwitcher collapsed={collapsed} />
      </SidebarHeader>

      <SidebarContent className="min-h-0 flex-1 gap-0 overflow-y-auto overflow-x-hidden py-2">
        <NavGroups collapsed={collapsed} />
      </SidebarContent>

      <SidebarFooter className="shrink-0 border-t border-sidebar-border p-2">
        <SidebarUser collapsed={collapsed} />
      </SidebarFooter>
    </Sidebar>
  );
}

const COLOR_MODES: { id: ColorMode; label: string; icon: Icon }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "Auto", icon: Monitor },
];

/** You, the theme and sign out, at the bottom of the phone menu. */
function MobileSidebarFooter({ onNavigate }: { onNavigate: () => void }) {
  const { user, signOut } = useAuth();
  const { colorMode, setColorMode } = useTheme();
  const name = user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user?.email ?? "Account";
  const initial = (user?.firstName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        <Link
          to="/settings"
          onClick={onNavigate}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {initial}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-sidebar-foreground">{name}</span>
            {user?.email && name !== user.email && (
              <span className="block truncate text-xs text-sidebar-foreground/55">{user.email}</span>
            )}
          </span>
        </Link>
        <button
          type="button"
          onClick={() => void signOut()}
          aria-label="Sign out"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sidebar-foreground/55 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <LogOut className="h-[18px] w-[18px]" />
        </button>
      </div>
      <div
        className="grid grid-cols-3 gap-1 rounded-xl bg-sidebar-accent/70 p-1"
        role="radiogroup"
        aria-label="Theme"
      >
        {COLOR_MODES.map(({ id, label, icon: ModeIcon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={colorMode === id}
            onClick={() => setColorMode(id)}
            className={cn(
              "flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              colorMode === id
                ? "bg-background font-medium text-foreground shadow-sm"
                : "text-sidebar-foreground/60 hover:text-sidebar-foreground",
            )}
          >
            <ModeIcon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The menu behind the top bar's button on phones and tablets: the same workspace switcher,
 * groups, badges and branches as the desktop sidebar, with rows big enough to tap.
 */
export function MobileSidebar({
  open,
  onOpenChange,
  onSearch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens the search; the menu closes first. */
  onSearch?: () => void;
}) {
  const close = () => onOpenChange(false);
  const navRef = useRef<HTMLElement>(null);

  // Open on the current page, even when it is far down the list.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() =>
      navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView?.({ block: "nearest" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[min(100vw-3rem,20rem)] gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground sm:max-w-[20rem] [&>button:last-child]:hidden"
      >
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SheetDescription className="sr-only">Pages, your workspace and your account.</SheetDescription>
        <NavSurface.Provider value={{ sheet: true, onNavigate: close }}>
          <div className="flex h-16 shrink-0 items-center gap-1 border-b border-sidebar-border px-2">
            <div className="min-w-0 flex-1">
              <WorkspaceSwitcher collapsed={false} />
            </div>
            <SheetClose
              aria-label="Close menu"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <X className="h-5 w-5" />
            </SheetClose>
          </div>

          {onSearch && (
            <div className="shrink-0 px-3 pt-3">
              <button
                type="button"
                onClick={() => {
                  close();
                  onSearch();
                }}
                className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-sidebar-border bg-background px-3 text-sm text-muted-foreground transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              >
                <Search className="h-4 w-4" />
                Search pages, posts and people
              </button>
            </div>
          )}

          <nav ref={navRef} aria-label="Main" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain py-2">
            <NavGroups collapsed={false} />
          </nav>

          <div className="shrink-0 border-t border-sidebar-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <MobileSidebarFooter onNavigate={close} />
          </div>
        </NavSurface.Provider>
      </SheetContent>
    </Sheet>
  );
}
