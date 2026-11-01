import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BackofficeRefundsTab } from "./BackofficeRefundsTab";
import { backofficeApi } from "@/lib/api";
import { confirmModal } from "@/components/ConfirmModal";

vi.mock("@/lib/api", () => ({
  backofficeApi: { listRefunds: vi.fn(), approveRefund: vi.fn(), rejectRefund: vi.fn() },
}));
vi.mock("@/components/ConfirmModal", () => ({ confirmModal: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const refund = {
  id: "r1",
  amount: "300.00",
  reason: "Charged twice",
  status: "PENDING",
  created_at: "2026-11-01T00:00:00Z",
  tenant: { name: "Kalulu" },
  deposit: { currency: "ZMW" },
};

describe("BackofficeRefundsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(backofficeApi.listRefunds).mockResolvedValue([refund] as never);
    vi.mocked(backofficeApi.approveRefund).mockResolvedValue({});
    vi.mocked(backofficeApi.rejectRefund).mockResolvedValue({});
  });

  it("lists who is asking and why", async () => {
    render(<BackofficeRefundsTab />);
    expect(await screen.findByText(/Kalulu/)).toBeTruthy();
    expect(screen.getByText("Charged twice")).toBeTruthy();
  });

  it("only approves after confirmation", async () => {
    vi.mocked(confirmModal).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<BackofficeRefundsTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    await waitFor(() => expect(confirmModal).toHaveBeenCalledTimes(1));
    expect(backofficeApi.approveRefund).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(backofficeApi.approveRefund).toHaveBeenCalledWith("r1"));
  });

  it("rejects with the admin's note", async () => {
    render(<BackofficeRefundsTab />);
    fireEvent.change(await screen.findByLabelText("Rejection note"), { target: { value: "Used the plan" } });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(backofficeApi.rejectRefund).toHaveBeenCalledWith("r1", "Used the plan"));
  });

  it("offers no actions on a finished refund", async () => {
    vi.mocked(backofficeApi.listRefunds).mockResolvedValue([{ ...refund, status: "REJECTED" }] as never);
    render(<BackofficeRefundsTab />);
    await screen.findByText(/Kalulu/);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
