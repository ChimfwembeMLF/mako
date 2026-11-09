import { useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Zap, Settings, CreditCard,
  Menu, LogOut, ChevronRight, Search, Sparkles, Layers,
  MoreHorizontal, Check, Sun, Moon, Monitor,
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { ColorModeToggle } from "@/components/ColorModeToggle";
import { GlobalSearch, GlobalSearchTrigger, useGlobalSearchShortcut } from "@/components/GlobalSearch";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { useTheme, type ColorMode } from "@/hooks/useTheme";
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
  NAV_GROUPS, SOCIAL_NAV_GROUPS, MORE_ITEMS,
  filterNavGroups, filterNavItems, type NavGroup, type NavItem,
} from "@/lib/nav-config";
import { resolveProductShell } from "@/lib/social-shell";

function isActivePath(pathname: string, url: string, exact = false) {
  if (exact) return pathname === url;
  return pathname === url || pathname.startsWith(`${url}/`);
}



const COLOR_MODES: { id: ColorMode; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

/** Your account: who you are, settings, billing, theme and sign out. Workspaces live in the sidebar. */
function UserMenu() {
  const { user, signOut } = useAuth();
  const { colorMode, setColorMode } = useTheme();
  const initials = (user?.firstName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();
  const name = user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "Account";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center rounded-full outline-none ring-offset-background transition-shadow hover:ring-2 hover:ring-border focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Account menu"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-1.5">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="gap-2">
          <Link to="/settings"><Settings className="h-4 w-4" /> Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="gap-2">
          <Link to="/billing"><CreditCard className="h-4 w-4" /> Billing</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="px-2 pb-1 pt-1.5 text-xs font-normal text-muted-foreground">Theme</DropdownMenuLabel>
        <div className="grid grid-cols-3 gap-1 px-1 pb-1" role="radiogroup" aria-label="Theme">
          {COLOR_MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={colorMode === id}
              onClick={() => setColorMode(id)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                colorMode === id
                  ? "border-foreground/20 bg-accent font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="gap-2 text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" /> Sign out
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
  const shell = resolveProductShell(pathname);
  const visibleMore = filterNavItems(MORE_ITEMS, canAny, isSuperAdmin, loading);
  const groups = filterNavGroups(
    shell === "social" ? SOCIAL_NAV_GROUPS : NAV_GROUPS,
    canAny,
    isSuperAdmin,
    loading,
  );
  const homeTo = shell === "social" ? "/social" : "/dashboard";
  const homeLabel = shell === "social" ? "Social" : "Dashboard";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden shrink-0 -ml-1 min-h-12 min-w-12">
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
            to={homeTo}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2.5 min-h-12 text-sm font-medium transition-colors",
              pathname === homeTo ? "bg-primary text-primary-foreground" : "hover:bg-surface-soft",
            )}
          >
            <Zap className="h-4 w-4" /> {homeLabel}
          </Link>

          {shell === "social" ? (
            <Link
              to="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 min-h-12 text-sm font-medium transition-colors hover:bg-surface-soft text-muted-foreground"
            >
              <Layers className="h-4 w-4" /> Main app
            </Link>
          ) : (
            <Link
              to="/social"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 min-h-12 text-sm font-medium transition-colors hover:bg-surface-soft text-muted-foreground"
            >
              <Sparkles className="h-4 w-4" /> Social
            </Link>
          )}

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
                      "flex items-center gap-2.5 rounded-lg px-3 py-2.5 min-h-12 text-sm transition-colors",
                      isActivePath(pathname, item.url)
                        ? "bg-primary/25 font-medium border-l-2 border-primary pl-[10px]"
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
                      "flex items-center gap-2.5 rounded-lg px-3 py-2.5 min-h-12 text-sm transition-colors",
                      isActivePath(pathname, item.url)
                        ? "bg-primary/25 font-medium border-l-2 border-primary pl-[10px]"
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
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 min-h-12 text-sm text-left transition-colors",
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
  const { pathname } = useLocation();
  const { canAny, isSuperAdmin, loading } = usePermissions();
  const visibleMore = filterNavItems(MORE_ITEMS, canAny, isSuperAdmin, loading);
  const shell = resolveProductShell(pathname);
  const homeTo = shell === "social" ? "/social" : "/dashboard";
  const homeLabel = shell === "social" ? "Social" : "Dashboard";

  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  useGlobalSearchShortcut(openSearch);

  return (
    <>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex h-16 items-center gap-2 px-3 sm:px-4 lg:px-6">
          <MobileNav />

          {/* Below desktop the sidebar is a rail or hidden, so the bar carries the logo. */}
          <Link to={homeTo} className="flex shrink-0 items-center lg:hidden" aria-label={`Mako ${homeLabel}`}>
            <Logo className="h-9 sm:h-10" />
          </Link>

          {/* Desktop: where you are, in the bar instead of a row above the page. */}
          <AppBreadcrumbs className="hidden min-w-0 flex-1 lg:flex [&_li]:text-sm" />

          <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
            <GlobalSearchTrigger onClick={openSearch} className="h-9 w-64 shadow-none xl:w-80" />
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full text-muted-foreground md:hidden"
              onClick={openSearch}
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </Button>

            <Button asChild size="sm" className="h-9 shrink-0 gap-1.5 rounded-full px-3 sm:px-4" aria-label="Create content">
              <Link to="/content?new=1">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Create</span>
              </Link>
            </Button>

            <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />

            <NotificationBell />
            <ColorModeToggle className="hidden h-9 min-h-0 w-9 min-w-0 rounded-full sm:inline-flex" />
            <UserMenu />
          </div>
        </div>
      </header>
    </>
  );
}
