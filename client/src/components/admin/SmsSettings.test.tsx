import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SmsSettings } from "./SmsSettings";
import { systemSettingsApi } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  systemSettingsApi: { getIntegrations: vi.fn(), updateIntegrations: vi.fn() },
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

describe("SmsSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(systemSettingsApi.getIntegrations).mockResolvedValue({});
    vi.mocked(systemSettingsApi.updateIntegrations).mockResolvedValue({ ok: true });
  });

  it("shows empty inputs when nothing is saved", async () => {
    render(<SmsSettings />);
    expect(await screen.findByPlaceholderText("Paste your Trinolux API key")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save SMS settings" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("saves the key and Sender ID", async () => {
    render(<SmsSettings />);
    fireEvent.change(await screen.findByLabelText("API key"), { target: { value: " key-1 " } });
    fireEvent.change(screen.getByLabelText("Sender ID"), { target: { value: "Mako" } });
    fireEvent.click(screen.getByRole("button", { name: "Save SMS settings" }));
    await waitFor(() =>
      expect(systemSettingsApi.updateIntegrations).toHaveBeenCalledWith({
        TRINOLUX_API_KEY: "key-1",
        TRINOLUX_SENDER_ID: "Mako",
      }),
    );
  });

  it("shows what's saved without ever showing the value", async () => {
    vi.mocked(systemSettingsApi.getIntegrations).mockResolvedValue({ TRINOLUX_API_KEY: "********" });
    render(<SmsSettings />);
    const input = (await screen.findByLabelText("API key")) as HTMLInputElement;
    expect(input.value).toBe("");
    expect(input.type).toBe("password");
    expect(input.placeholder).toContain("Saved");
  });

  it("keeps the saved key when only the Sender ID changes", async () => {
    vi.mocked(systemSettingsApi.getIntegrations).mockResolvedValue({ TRINOLUX_API_KEY: "********" });
    render(<SmsSettings />);
    fireEvent.change(await screen.findByLabelText("Sender ID"), { target: { value: "Mako" } });
    fireEvent.click(screen.getByRole("button", { name: "Save SMS settings" }));
    await waitFor(() =>
      expect(systemSettingsApi.updateIntegrations).toHaveBeenCalledWith({ TRINOLUX_SENDER_ID: "Mako" }),
    );
  });
});
