import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BackofficeSubscriptionsTab } from "./BackofficeSubscriptionsTab";
import { backofficeApi } from "@/lib/api";

vi.mock("@/lib/api", () => ({ backofficeApi: { listSubscriptions: vi.fn() } }));

const row = (over: Record<string, unknown>) => ({
  tenantId: "t",
  tenantName: "Tenant",
  ownerEmail: "owner@x.co",
  plan: "pro",
  status: "active",
  monthlyPriceZmw: 300,
  billingPeriodEnd: "2026-12-01T00:00:00Z",
  autoRenewEnabled: true,
  renewalAttempts: 0,
  lastRenewalAttemptAt: null,
  expiringSoon: false,
  ...over,
});

const report = {
  summary: { paying: 2, pastDue: 1, expiringSoon: 1, mrrZmw: 600 },
  rows: [
    row({ tenantId: "late", tenantName: "Late Co", status: "past_due", renewalAttempts: 2 }),
    row({ tenantId: "soon", tenantName: "Soon Co", expiringSoon: true }),
    row({ tenantId: "ok", tenantName: "Fine Co", ownerEmail: "boss@fine.co" }),
    row({ tenantId: "free", tenantName: "Free Co", plan: "free", monthlyPriceZmw: 0, billingPeriodEnd: null }),
  ],
};

describe("BackofficeSubscriptionsTab", () => {
  beforeEach(() => {
    vi.mocked(backofficeApi.listSubscriptions).mockResolvedValue(report as never);
  });

  it("shows the summary and every tenant", async () => {
    render(<BackofficeSubscriptionsTab onOpenTenant={() => {}} />);
    expect(await screen.findByText("ZMW 600")).toBeTruthy();
    for (const name of ["Late Co", "Soon Co", "Fine Co", "Free Co"]) {
      expect(screen.getByText(name)).toBeTruthy();
    }
  });

  it.each([
    ["Past due", ["Late Co"]],
    ["Expiring soon", ["Soon Co"]],
    ["Paying", ["Soon Co", "Fine Co"]],
  ])("filters to %s", async (label, expected) => {
    render(<BackofficeSubscriptionsTab onOpenTenant={() => {}} />);
    await screen.findByText("Late Co");
    fireEvent.click(screen.getByRole("button", { name: label }));
    const shown = ["Late Co", "Soon Co", "Fine Co", "Free Co"].filter((n) => screen.queryByText(n));
    expect(shown).toEqual(expected);
  });

  it("searches by owner email and says when nothing matches", async () => {
    render(<BackofficeSubscriptionsTab onOpenTenant={() => {}} />);
    await screen.findByText("Late Co");
    const search = screen.getByLabelText("Search subscriptions");
    fireEvent.change(search, { target: { value: "BOSS@" } });
    expect(screen.getByText("Fine Co")).toBeTruthy();
    expect(screen.queryByText("Late Co")).toBeNull();
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText("No subscriptions match.")).toBeTruthy();
  });

  it("opens the tenant when a row is clicked", async () => {
    const onOpenTenant = vi.fn();
    render(<BackofficeSubscriptionsTab onOpenTenant={onOpenTenant} />);
    fireEvent.click(await screen.findByText("Soon Co"));
    expect(onOpenTenant).toHaveBeenCalledWith("soon");
  });

  it("shows the error when loading fails", async () => {
    vi.mocked(backofficeApi.listSubscriptions).mockRejectedValue(new Error("Nope"));
    render(<BackofficeSubscriptionsTab onOpenTenant={() => {}} />);
    expect(await screen.findByText("Nope")).toBeTruthy();
  });
});
