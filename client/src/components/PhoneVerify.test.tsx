import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PhoneVerifyForm } from "./PhoneVerifyForm";
import { PhoneVerifyPrompt } from "./PhoneVerifyPrompt";
import { authApi } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  authApi: { phoneStatus: vi.fn(), sendPhoneCode: vi.fn(), verifyPhoneCode: vi.fn() },
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const sendTo = async (number: string) => {
  fireEvent.change(screen.getByLabelText("Zambian mobile number"), { target: { value: number } });
  fireEvent.click(screen.getByRole("button", { name: "Send code" }));
};

describe("PhoneVerifyForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.sendPhoneCode).mockResolvedValue({ sent: true });
    vi.mocked(authApi.verifyPhoneCode).mockResolvedValue({ verified: true });
  });

  it("sends a code, then verifies it", async () => {
    const onVerified = vi.fn();
    render(<PhoneVerifyForm onVerified={onVerified} />);
    await sendTo("0971234567");
    const code = await screen.findByLabelText("6-digit code");
    expect(authApi.sendPhoneCode).toHaveBeenCalledWith("0971234567");
    fireEvent.change(code, { target: { value: "12a3456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => expect(authApi.verifyPhoneCode).toHaveBeenCalledWith("123456"));
    await waitFor(() => expect(onVerified).toHaveBeenCalled());
  });

  it("needs all six digits", async () => {
    render(<PhoneVerifyForm onVerified={vi.fn()} />);
    await sendTo("0971234567");
    fireEvent.change(await screen.findByLabelText("6-digit code"), { target: { value: "123" } });
    expect((screen.getByRole("button", { name: "Verify" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows why a number was refused", async () => {
    vi.mocked(authApi.sendPhoneCode).mockRejectedValue(new Error("This number is already in use"));
    render(<PhoneVerifyForm onVerified={vi.fn()} />);
    await sendTo("0971234567");
    expect((await screen.findByRole("alert")).textContent).toContain("already in use");
  });

  it("stays on the code step after a wrong code", async () => {
    vi.mocked(authApi.verifyPhoneCode).mockRejectedValue(new Error("Invalid or expired code"));
    const onVerified = vi.fn();
    render(<PhoneVerifyForm onVerified={onVerified} />);
    await sendTo("0971234567");
    fireEvent.change(await screen.findByLabelText("6-digit code"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Invalid");
    expect(onVerified).not.toHaveBeenCalled();
  });
});

describe("PhoneVerifyPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("asks a user with no verified phone", async () => {
    vi.mocked(authApi.phoneStatus).mockResolvedValue({ available: true, verified: false, phone: null });
    render(<PhoneVerifyPrompt />);
    expect(await screen.findByText("Add your phone number")).toBeTruthy();
  });

  it.each([
    ["the phone is verified", { available: true, verified: true, phone: "***567" }],
    ["SMS isn't configured", { available: false, verified: false, phone: null }],
  ])("stays hidden when %s", async (_name, status) => {
    vi.mocked(authApi.phoneStatus).mockResolvedValue(status);
    render(<PhoneVerifyPrompt />);
    await waitFor(() => expect(authApi.phoneStatus).toHaveBeenCalled());
    expect(screen.queryByText("Add your phone number")).toBeNull();
  });

  it("can be put off for the session", async () => {
    vi.mocked(authApi.phoneStatus).mockResolvedValue({ available: true, verified: false, phone: null });
    const { unmount } = render(<PhoneVerifyPrompt />);
    fireEvent.click(await screen.findByRole("button", { name: "Remind me later" }));
    unmount();
    vi.mocked(authApi.phoneStatus).mockClear();
    render(<PhoneVerifyPrompt />);
    expect(authApi.phoneStatus).not.toHaveBeenCalled();
  });
});
