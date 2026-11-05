import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

const signOut = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const perms = vi.hoisted(() => ({
  granted: new Set<string>(),
  isSuperAdmin: false,
  loading: false,
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ signOut }) }));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    isSuperAdmin: perms.isSuperAdmin,
    loading: perms.loading,
    canAny: (...keys: string[]) => keys.some((k) => perms.granted.has(k)),
  }),
}));
vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({ tenant: { id: "t1", name: "Mako" }, tenants: [], switchTenant: vi.fn() }),
}));
vi.mock("@/hooks/useWorkspace", () => ({
  useWorkspace: () => ({ workspaces: [], activeWorkspace: null, setActiveWorkspace: vi.fn(), loading: false }),
}));

function renderSidebar() {
  render(
    <MemoryRouter>
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    </MemoryRouter>,
  );
}

describe("AppSidebar", () => {
  beforeEach(() => {
    perms.granted = new Set(["content.view", "analytics.view"]);
    perms.isSuperAdmin = false;
    perms.loading = false;
  });

  it("signs out from the bottom of the sidebar", () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("hides pages the person has no permission for", () => {
    renderSidebar();
    expect(screen.getByRole("link", { name: "Schedule" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Analytics" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Roles & permissions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Leads" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Platform backoffice" })).not.toBeInTheDocument();
  });

  it("shows admin pages to a super admin", () => {
    perms.isSuperAdmin = true;
    renderSidebar();
    expect(screen.getByRole("link", { name: "Roles & permissions" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Platform backoffice" })).toBeInTheDocument();
  });
});
