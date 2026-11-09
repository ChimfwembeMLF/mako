import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
const counts = vi.hoisted(() => ({ unread: 0, pending: 0 }));
vi.mock("@/lib/api", () => ({
  inboxApi: {
    conversations: vi.fn(async () =>
      Array.from({ length: 3 }, (_, i) => ({ id: `c${i}`, unreadCount: i < counts.unread ? 2 : 0 })),
    ),
  },
  approvalRequestsApi: { findAll: vi.fn(async () => Array.from({ length: counts.pending }, (_, i) => ({ id: `a${i}` }))) },
}));

vi.mock("@/hooks/useWorkspace", () => ({
  useWorkspace: () => ({ workspaces: [], activeWorkspace: null, setActiveWorkspace: vi.fn(), loading: false }),
}));

function renderSidebar(path = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AppSidebar", () => {
  beforeEach(() => {
    perms.granted = new Set(["content.view", "analytics.view"]);
    perms.isSuperAdmin = false;
    perms.loading = false;
    counts.unread = 0;
    counts.pending = 0;
    localStorage.clear();
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

  it("shows admin pages to a super admin under Manage", () => {
    perms.isSuperAdmin = true;
    renderSidebar();
    expect(screen.queryByRole("link", { name: "Roles & permissions" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    expect(screen.getByRole("link", { name: "Roles & permissions" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Platform backoffice" })).toBeInTheDocument();
  });

  it("opens Manage by itself when you are on one of its pages", () => {
    perms.granted.add("team.view");
    renderSidebar("/team");
    expect(screen.getByRole("link", { name: "Members" })).toBeInTheDocument();
  });

  it("remembers that Manage was opened", () => {
    perms.granted.add("team.view");
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    expect(localStorage.getItem("mako_sidebar_manage_open")).toBe("1");
  });

  it("shows how many conversations and approvals are waiting", async () => {
    perms.granted = new Set(["replies.view", "approvals.view"]);
    counts.unread = 2;
    counts.pending = 4;
    renderSidebar();
    expect(await screen.findByRole("link", { name: "Inbox, 2 waiting" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Approvals, 4 waiting" })).toBeInTheDocument();
  });

  it("shows no badge when nothing is waiting", async () => {
    perms.granted = new Set(["replies.view"]);
    renderSidebar();
    expect(await screen.findByRole("link", { name: "Inbox" })).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
