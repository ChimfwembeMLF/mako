import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

const signOut = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ signOut }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ isSuperAdmin: false }) }));
vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({ tenant: { id: "t1", name: "Mako" }, tenants: [], switchTenant: vi.fn() }),
}));
vi.mock("@/hooks/useWorkspace", () => ({
  useWorkspace: () => ({ workspaces: [], activeWorkspace: null, setActiveWorkspace: vi.fn(), loading: false }),
}));

describe("AppSidebar", () => {
  it("signs out from the bottom of the sidebar", () => {
    render(
      <MemoryRouter>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
