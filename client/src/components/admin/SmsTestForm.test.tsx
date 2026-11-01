import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SmsTestForm } from "./SmsTestForm";
import { backofficeApi } from "@/lib/api";

vi.mock("@/lib/api", () => ({ backofficeApi: { sendTestSms: vi.fn() } }));

const fillIn = () =>
  fireEvent.change(screen.getByLabelText("Zambian mobile number"), { target: { value: "0971234567" } });

describe("SmsTestForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("needs a number before sending", () => {
    render(<SmsTestForm />);
    expect((screen.getByRole("button", { name: "Send test" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("says accepted, not delivered", async () => {
    vi.mocked(backofficeApi.sendTestSms).mockResolvedValue({ accepted: true, status: "Queued", messageIds: [1] });
    render(<SmsTestForm />);
    fillIn();
    fireEvent.click(screen.getByRole("button", { name: "Send test" }));
    expect((await screen.findByRole("status")).textContent).toContain("accepted");
    expect(backofficeApi.sendTestSms).toHaveBeenCalledWith({ to: "0971234567", message: "Mako SMS test" });
  });

  it("shows why a send failed", async () => {
    vi.mocked(backofficeApi.sendTestSms).mockRejectedValue(new Error("insufficient balance"));
    render(<SmsTestForm />);
    fillIn();
    fireEvent.click(screen.getByRole("button", { name: "Send test" }));
    expect((await screen.findByRole("status")).textContent).toContain("insufficient balance");
  });
});
