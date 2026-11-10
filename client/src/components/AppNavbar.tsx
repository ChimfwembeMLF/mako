import { useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { Settings, CreditCard, Menu, LogOut, Search, Sparkles, Sun, Moon, Monitor } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { ColorModeToggle } from "@/components/ColorModeToggle";
import { GlobalSearch, GlobalSearchTrigger, useGlobalSearchShortcut } from "@/components/GlobalSearch";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { useTheme, type ColorMode } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import Logo from "./Logo";
import { MobileSidebar } from "@/components/AppSidebar";
import { resolveProductShell } from "@/lib/social-shell";

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

export function AppNavbar() {
  const { pathname } = useLocation();
  const shell = resolveProductShell(pathname);
  const homeTo = shell === "social" ? "/social" : "/dashboard";
  const homeLabel = shell === "social" ? "Social" : "Dashboard";

  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  useGlobalSearchShortcut(openSearch);

  return (
    <>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex h-16 items-center gap-2 px-3 sm:px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-1 h-11 w-11 shrink-0 rounded-xl lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <MobileSidebar open={menuOpen} onOpenChange={setMenuOpen} onSearch={openSearch} />

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
