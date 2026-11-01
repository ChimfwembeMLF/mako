import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IntegrationSettings } from "./IntegrationSettings";
import { tenantIntegrationConfigsApi, tenantsApi } from "@/lib/api";
import { confirmModal } from "@/components/ConfirmModal";

const hook = vi.hoisted(() => ({
  configs: [] as Array<{ provider: string; updatedAt: string }>,
  upsertConfig: vi.fn(),
  deleteConfig: vi.fn(),
}));
const perms = vi.hoisted(() => ({ canManage: true }));

vi.mock("@/hooks/api/useTenantIntegrationConfigs", () => ({
  useTenantIntegrationConfigs: () => ({ ...hook, isLoading: false, isDeleting: false }),
}));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: () => perms.canManage, isSuperAdmin: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/ConfirmModal", () => ({ confirmModal: vi.fn() }));
vi.mock("@/lib/api", () => ({
  API_BASE_URL: "",
  getAuthToken: () => "t",
  tenantsApi: { findOne: vi.fn(), update: vi.fn() },
  tenantIntegrationConfigsApi: { testConfig: vi.fn() },
}));

const savedKey = (provider: string) => ({ provider, updatedAt: "2026-11-01T00:00:00Z" });

function show(preferred: string | null = null) {
  vi.mocked(tenantsApi.findOne).mockResolvedValue({ preferredAiProvider: preferred } as never);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <IntegrationSettings tenantId="t1" />
    </QueryClientProvider>,
  );
}

const row = (name: string) => screen.getByText(name, { selector: "div" }).closest("div.rounded-lg") as HTMLElement;

describe("IntegrationSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hook.configs = [];
    perms.canManage = true;
    hook.upsertConfig.mockResolvedValue({});
    hook.deleteConfig.mockResolvedValue({});
    vi.mocked(tenantsApi.update).mockResolvedValue({} as never);
    vi.mocked(tenantIntegrationConfigsApi.testConfig).mockResolvedValue({ ok: true });
  });

  it("shows Mistral in use by default", async () => {
    show();
    expect(await within(row("Mistral AI")).findByText("In use")).toBeTruthy();
  });

  it("won't let you pick a provider with no key", () => {
    show();
    expect(within(row("OpenAI")).queryByRole("button", { name: "Use this" })).toBeNull();
    expect(within(row("OpenAI")).getByRole("button", { name: "Add key" })).toBeTruthy();
  });

  it("offers no key field for Parler", () => {
    show();
    const parler = within(row("Self-Hosted Parler"));
    expect(parler.queryByRole("button", { name: "Add key" })).toBeNull();
    expect(parler.getByRole("button", { name: "Use this" })).toBeTruthy();
  });

  it("saves a key, then tests it and shows the result", async () => {
    show();
    fireEvent.click(within(row("OpenAI")).getByRole("button", { name: "Add key" }));
    const save = screen.getByRole("button", { name: "Save and test" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("OpenAI API key"), { target: { value: "  sk-1 " } });
    fireEvent.click(save);
    await waitFor(() =>
      expect(hook.upsertConfig).toHaveBeenCalledWith({ provider: "openai", apiKey: "sk-1" }),
    );
    expect(await screen.findByText("This key works.")).toBeTruthy();
    expect(screen.queryByLabelText("OpenAI API key")).toBeNull();
  });

  it("shows why a key failed", async () => {
    hook.configs = [savedKey("gemini")];
    vi.mocked(tenantIntegrationConfigsApi.testConfig).mockResolvedValue({ ok: false, message: "Quota exceeded" });
    show();
    fireEvent.click(within(row("Google Gemini")).getByRole("button", { name: "Test" }));
    expect(await screen.findByText(/Quota exceeded/)).toBeTruthy();
  });

  it("switches to a provider once it has a key", async () => {
    hook.configs = [savedKey("openai")];
    show();
    fireEvent.click(within(row("OpenAI")).getByRole("button", { name: "Use this" }));
    await waitFor(() =>
      expect(tenantsApi.update).toHaveBeenCalledWith("t1", { preferredAiProvider: "openai" }),
    );
  });

  it("keeps the key if removal isn't confirmed", async () => {
    hook.configs = [savedKey("openai")];
    vi.mocked(confirmModal).mockResolvedValue(false);
    show();
    fireEvent.click(within(row("OpenAI")).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(confirmModal).toHaveBeenCalled());
    expect(hook.deleteConfig).not.toHaveBeenCalled();
  });

  it("switches back to Mistral when the key in use is removed", async () => {
    hook.configs = [savedKey("openai")];
    vi.mocked(confirmModal).mockResolvedValue(true);
    show("openai");
    await within(row("OpenAI")).findByText("In use");
    fireEvent.click(within(row("OpenAI")).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(hook.deleteConfig).toHaveBeenCalledWith("openai"));
    expect(tenantsApi.update).toHaveBeenCalledWith("t1", { preferredAiProvider: "mistral" });
  });

  it("is read-only without permission", () => {
    perms.canManage = false;
    hook.configs = [savedKey("openai")];
    show();
    expect(screen.getByText(/Only workspace owners and admins/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows Google Drive as connected", () => {
    hook.configs = [savedKey("google_drive")];
    show();
    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeTruthy();
    expect(screen.queryByText("google_drive")).toBeNull();
  });
});
