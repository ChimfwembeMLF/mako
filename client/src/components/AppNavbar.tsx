import { useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Zap, Settings, CreditCard, Building2,
  Menu, LogOut, ChevronRight, Search, Sparkles, Layers,
  MoreHorizontal, Check,
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch, GlobalSearchTrigger, useGlobalSearchShortcut } from "@/components/GlobalSearch";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { NavLink } from "@/components/NavLink";
import Logo from "./Logo";
import {
  NAV_GROUPS, MORE_ITEMS, filterNavGroups, filterNavItems, type NavGroup, type NavItem,
} from "@/lib/nav-config";

function isActivePath(pathname: string, url: string, exact = false) {
  if (exact) return pathname === url;
  return pathname === url || pathname.startsWith(`${url}/`);
}

function isGroupActive(pathname: string, group: NavGroup) {
  return group.items.some((item) => isActivePath(pathname, item.url));
}

function NavLinkItem({
  to,
  children,
  end,
  className,
}: {
  to: string;
  children: React.ReactNode;
  end?: boolean;
  className?: string;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={cn(
        "relative px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
      activeClassName="!text-foreground after:absolute after:bottom-0 after:inset-x-2 after:h-0.5 after:bg-foreground after:rounded-full"
    >
      {children}
    </NavLink>
  );
}

function AppsMenu() {
  const { pathname } = useLocation();
  const { canAny, isSuperAdmin, loading } = usePermissions();
  const groups = filterNavGroups(NAV_GROUPS, canAny, isSuperAdmin, loading);
  const active = groups.some((group) => isGroupActive(pathname, group));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative inline-flex items-center gap-0.5 px-2.5 py-2 text-sm font-medium transition-colors outline-none",
            active
              ? "text-foreground after:absolute after:bottom-0 after:inset-x-2 after:h-0.5 after:bg-foreground after:rounded-full"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Apps
          <ChevronRight className="h-3 w-3 rotate-90 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 p-2 max-h-[min(80vh,32rem)] overflow-y-auto">
        {groups.map((group, index) => (
          <div key={group.label} className={cn(index > 0 && "mt-2 pt-2 border-t border-border")}>
            <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </p>
            {group.items.map((item) => (
              <DropdownMenuItem key={item.url} asChild className="p-0 focus:bg-transparent">
                <Link
                  to={item.url}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2 py-2 w-full text-sm transition-colors hover:bg-surface-soft",
                    isActivePath(pathname, item.url) && "bg-surface-soft text-foreground font-medium",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0 opacity-70" />
                  <span className="truncate">{item.title}</span>
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MoreMenu({ items }: { items: NavItem[] }) {
  const { pathname } = useLocation();
  if (items.length === 0) return null;

  const active = items.some((item) => isActivePath(pathname, item.url));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="More"
          className={cn(
            "relative inline-flex items-center justify-center h-9 w-9 rounded-full transition-colors outline-none",
            active
              ? "bg-surface-soft text-foreground"
              : "text-muted-foreground hover:bg-surface-soft hover:text-foreground",
          )}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {items.map((item) => (
          <DropdownMenuItem key={item.url} asChild>
            <Link
              to={item.url}
              className={cn(
                "flex items-center gap-2 w-full",
                isActivePath(pathname, item.url) && "font-medium",
              )}
            >
              <item.icon className="h-4 w-4 opacity-70" />
              {item.title}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const { workspaces, activeWorkspace, setActiveWorkspace, loading } = useWorkspace();
  const initials = (user?.firstName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();
  const activeName =
    workspaces.find((w: { id: string }) => w.id === activeWorkspace)?.name ?? "Workspace";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Account menu"
        >
          <Avatar className="h-8 w-8 border border-border">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal pb-1">
          <p className="text-sm font-medium truncate">
            {user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "Account"}
          </p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Workspace
        </DropdownMenuLabel>
        {loading ? (
          <DropdownMenuItem disabled className="text-xs">Loading…</DropdownMenuItem>
        ) : workspaces.length === 0 ? (
          <DropdownMenuItem asChild>
            <Link to="/workspaces" className="flex items-center gap-2">
              <Layers className="h-4 w-4" /> Create workspace
            </Link>
          </DropdownMenuItem>
        ) : (
          workspaces.map((ws: { id: string; name: string }) => (
            <DropdownMenuItem
              key={ws.id}
              onClick={() => setActiveWorkspace(ws.id)}
              className="flex items-center gap-2"
            >
              <Layers className="h-4 w-4 shrink-0 opacity-70" />
              <span className="truncate flex-1">{ws.name}</span>
              {ws.id === activeWorkspace && <Check className="h-3.5 w-3.5 shrink-0" />}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuItem asChild>
          <Link to="/workspaces" className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="h-4 w-4" />
            Manage workspaces
            {!loading && activeName ? (
              <span className="ml-auto truncate max-w-[7rem] text-xs">{activeName}</span>
            ) : null}
          </Link>
        </DropdownMenuItem>
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
  const { canAny, isSuperAdmin, loading } = usePermissions();
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspace();
  const visibleMore = filterNavItems(MORE_ITEMS, canAny, isSuperAdmin, loading);
  const groups = filterNavGroups(NAV_GROUPS, canAny, isSuperAdmin, loading);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden shrink-0 -ml-1">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex h-full max-h-[100dvh] w-[min(100vw-2rem,20rem)] flex-col overflow-hidden p-0">
        <SheetHeader className="shrink-0 border-b px-4 py-3 pr-12 text-left">
          <SheetTitle className="flex items-center gap-2 text-base font-semibold">
            <Logo className="h-8" />
          </SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-5">
          <Link
            to="/dashboard"
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathname === "/dashboard" ? "bg-foreground text-background" : "hover:bg-surface-soft",
            )}
          >
            <Zap className="h-4 w-4" /> Dashboard
          </Link>

          {groups.map((group) => (
            <div key={group.label}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 px-2">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <Link
                    key={item.url}
                    to={item.url}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                      isActivePath(pathname, item.url)
                        ? "bg-surface-soft font-medium"
                        : "hover:bg-surface-soft",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0 opacity-70" />
                    {item.title}
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {visibleMore.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 px-2">
                More
              </p>
              <div className="space-y-0.5">
                {visibleMore.map((item) => (
                  <Link
                    key={item.url}
                    to={item.url}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                      isActivePath(pathname, item.url)
                        ? "bg-surface-soft font-medium"
                        : "hover:bg-surface-soft",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0 opacity-70" />
                    {item.title}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {workspaces.length > 0 && (
            <div className="border-t pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 px-2">
                Workspace
              </p>
              {workspaces.map((ws: { id: string; name: string }) => (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => {
                    setActiveWorkspace(ws.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors",
                    ws.id === activeWorkspace ? "bg-surface-soft font-medium" : "hover:bg-surface-soft",
                  )}
                >
                  <Layers className="h-4 w-4 shrink-0 opacity-70" />
                  <span className="truncate">{ws.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function AppNavbar() {
  const { canAny, isSuperAdmin, loading } = usePermissions();
  const visibleMore = filterNavItems(MORE_ITEMS, canAny, isSuperAdmin, loading);

  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  useGlobalSearchShortcut(openSearch);

  return (
    <>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-2 px-4 md:px-6">
          <MobileNav />

          <Link to="/dashboard" className="flex shrink-0 items-center mr-2 lg:mr-4">
            <Logo className="h-11" />
          </Link>

          <nav className="hidden lg:flex items-center gap-0.5 min-w-0">
            <NavLinkItem to="/dashboard" end>Dashboard</NavLinkItem>
            <AppsMenu />
          </nav>

          <div className="hidden md:flex flex-1 justify-center max-w-md mx-2 lg:mx-4">
            <GlobalSearchTrigger onClick={openSearch} className="max-w-sm w-full" />
          </div>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground md:hidden"
              onClick={openSearch}
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </Button>

            <Button
              asChild
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground xl:hidden"
              aria-label="Create content"
            >
              <Link to="/content">
                <Sparkles className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="hidden xl:inline-flex shrink-0 gap-1.5 rounded-sm px-3"
            >
              <Link to="/content">
                <Sparkles className="h-3.5 w-3.5" />
                Create
              </Link>
            </Button>

            <NotificationBell />
            <div className="hidden lg:contents">
              <MoreMenu items={visibleMore} />
            </div>
            <UserMenu />
          </div>
        </div>
      </header>
    </>
  );
}
