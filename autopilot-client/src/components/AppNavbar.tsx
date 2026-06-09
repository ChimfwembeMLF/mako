import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Brain, Pen, CalendarClock, MessageSquare, BarChart3, Zap, Settings,
  Rocket, Link2, Image, LayoutTemplate, MessageSquareReply,
  GitPullRequestArrow, Users, ClipboardList, ShieldCheck,
  ChevronsUpDown, Building2, CreditCard, Download, Menu, LogOut,
  Sparkles, ChevronRight,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { P, type PermissionKey } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  /** Tenant permission required (any of if array) */
  permission?: PermissionKey | PermissionKey[];
  /** Platform Super Admin only */
  superAdmin?: boolean;
};
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Studio",
    items: [
      { title: "Brand Brain", url: "/brand-brain", icon: Brain, description: "Identity, voice & audience" },
      { title: "Content Engine", url: "/content", icon: Pen, description: "Generate on-brand content" },
      { title: "Scheduler", url: "/scheduler", icon: CalendarClock, description: "Plan & publish posts" },
      { title: "Publisher", url: "/publisher", icon: Link2, description: "Connect social accounts" },
    ],
  },
  {
    label: "Engage",
    items: [
      { title: "Lead Agent", url: "/leads", icon: MessageSquare, description: "Qualify & reply to leads" },
      { title: "Replies", url: "/replies", icon: MessageSquareReply, description: "Auto-reply rules" },
      { title: "Analytics", url: "/analytics", icon: BarChart3, description: "Performance insights" },
    ],
  },
  {
    label: "Library",
    items: [
      { title: "Media Library", url: "/media", icon: Image, description: "Images & assets" },
      { title: "Templates", url: "/templates", icon: LayoutTemplate, description: "Reusable content" },
      { title: "Workspaces", url: "/workspaces", icon: Building2, description: "Organize by brand" },
    ],
  },
];

const MORE_ITEMS: NavItem[] = [
  { title: "Approvals", url: "/approvals", icon: GitPullRequestArrow, permission: P.approvals.view },
  { title: "Team", url: "/team", icon: Users, permission: P.team.view },
  { title: "Audit Logs", url: "/audit", icon: ClipboardList, permission: P.audit.view },
  { title: "Roles & Permissions", url: "/admin/roles", icon: ShieldCheck, permission: P.admin.roles },
  { title: "Maker-Checker", url: "/admin/maker-checker", icon: GitPullRequestArrow, permission: P.admin.makerChecker },
  { title: "System Settings", url: "/admin/system", icon: Settings, superAdmin: true },
  { title: "Export Data", url: "/export", icon: Download, permission: P.leads.export },
  { title: "Billing", url: "/billing", icon: CreditCard, permission: P.settings.billing },
  { title: "Settings", url: "/settings", icon: Settings, permission: P.settings.view },
];

function useVisibleNavItems(items: NavItem[]) {
  const { canAny, isSuperAdmin, loading } = usePermissions();
  if (loading) return [];
  return items.filter((item) => {
    if (item.superAdmin) return isSuperAdmin;
    if (!item.permission) return true;
    const perms = Array.isArray(item.permission) ? item.permission : [item.permission];
    return canAny(...perms);
  });
}

function isActivePath(pathname: string, url: string, exact = false) {
  if (exact) return pathname === url;
  return pathname === url || pathname.startsWith(`${url}/`);
}

function NavPill({ to, children, end }: { to: string; children: React.ReactNode; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className="px-3.5 py-1.5 rounded-full text-sm font-medium text-muted-foreground transition-all hover:text-foreground hover:bg-muted/80"
      activeClassName="!text-primary-foreground bg-primary shadow-sm shadow-primary/25 !hover:bg-primary"
    >
      {children}
    </NavLink>
  );
}

function NavDropdown({ group }: { group: NavGroup }) {
  const { pathname } = useLocation();
  const active = group.items.some((item) => isActivePath(pathname, item.url));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all outline-none",
            active
              ? "text-primary-foreground bg-primary shadow-sm shadow-primary/25"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/80",
          )}
        >
          {group.label}
          <ChevronRight className="h-3 w-3 rotate-90 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-2">
        {group.items.map((item) => (
          <DropdownMenuItem key={item.url} asChild className="p-0 focus:bg-transparent">
            <Link
              to={item.url}
              className={cn(
                "flex items-start gap-3 rounded-lg px-3 py-2.5 w-full transition-colors hover:bg-muted",
                isActivePath(pathname, item.url) && "bg-primary/10 text-primary",
              )}
            >
              <item.icon className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium leading-none">{item.title}</p>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                )}
              </div>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TenantSwitcher() {
  const { tenant, tenants, switchTenant, membership } = useTenant();
  const { isSuperAdmin, roleName } = usePermissions();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="hidden sm:flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1.5 text-xs hover:bg-muted/70 transition-colors max-w-[180px]">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{tenant?.name ?? "Workspace"}</span>
          {tenants.length > 1 && <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Active workspace
        </DropdownMenuLabel>
        <DropdownMenuItem disabled className="font-medium flex-wrap gap-1">
          <span className="truncate">{tenant?.name}</span>
          <span className="ml-auto flex gap-1 shrink-0">
            {isSuperAdmin && (
              <Badge variant="default" className="text-[10px]">Super Admin</Badge>
            )}
            {(membership?.role_name ?? roleName) && (
              <Badge variant="secondary" className="text-[10px]">{membership?.role_name ?? roleName}</Badge>
            )}
          </span>
        </DropdownMenuItem>
        {tenants.length > 1 && (
          <>
            <DropdownMenuSeparator />
            {tenants.filter((t) => t.id !== tenant?.id).map((t) => (
              <DropdownMenuItem key={t.id} onClick={() => switchTenant(t.id)}>
                <Building2 className="h-3.5 w-3.5 mr-2" />
                {t.name}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const initials = (user?.firstName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar className="h-8 w-8 border-2 border-primary/20">
            <AvatarFallback className="gradient-primary text-primary-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium truncate">{user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "Account"}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings"><Settings className="h-4 w-4 mr-2" /> Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/billing"><CreditCard className="h-4 w-4 mr-2" /> Billing</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileNav() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const visibleMore = useVisibleNavItems(MORE_ITEMS);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden shrink-0">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 p-0">
        <SheetHeader className="p-4 border-b text-left">
          <SheetTitle className="flex items-center gap-2 font-display">
            <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
              <Rocket className="h-4 w-4 text-primary-foreground" />
            </div>
            BrandPilot
          </SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto p-4 space-y-6">
          <Link
            to="/"
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              pathname === "/" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            <Zap className="h-4 w-4" /> Dashboard
          </Link>

          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 px-1">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <Link
                    key={item.url}
                    to={item.url}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                      isActivePath(pathname, item.url)
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.title}
                  </Link>
                ))}
              </div>
            </div>
          ))}

          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 px-1">
              More
            </p>
            <div className="space-y-0.5">
              {visibleMore.map((item) => (
                <Link
                  key={item.url}
                  to={item.url}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                    isActivePath(pathname, item.url)
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.title}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function AppNavbar() {
  const { pathname } = useLocation();
  const visibleMore = useVisibleNavItems(MORE_ITEMS);
  const moreActive = visibleMore.some((item) => isActivePath(pathname, item.url));

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/75 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-3 px-4 md:px-6">
        <MobileNav />

        <Link to="/" className="flex items-center gap-2.5 shrink-0 mr-1">
          <div className="h-8 w-8 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
            <Rocket className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-base hidden sm:block tracking-tight">BrandPilot</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
          <NavPill to="/" end>Dashboard</NavPill>
          {NAV_GROUPS.map((group) => (
            <NavDropdown key={group.label} group={group} />
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all outline-none",
                  moreActive
                    ? "text-primary-foreground bg-primary shadow-sm shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/80",
                )}
              >
                More
                <ChevronRight className="h-3 w-3 rotate-90 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-52">
              {visibleMore.map((item) => (
                <DropdownMenuItem key={item.url} asChild>
                  <Link
                    to={item.url}
                    className={cn(
                      "flex items-center gap-2 w-full",
                      isActivePath(pathname, item.url) && "text-primary",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            asChild
            size="sm"
            className="hidden md:inline-flex gap-1.5 rounded-full gradient-primary border-0 shadow-glow hover:opacity-90"
          >
            <Link to="/content">
              <Sparkles className="h-3.5 w-3.5" />
              Create
            </Link>
          </Button>
          <TenantSwitcher />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
