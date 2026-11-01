import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CampaignCard } from "./CampaignsPage";
import { contentCampaignsApi } from "@/lib/api";
import { confirmModal } from "@/components/ConfirmModal";

const perms = vi.hoisted(() => ({ canApprove: true }));
const toast = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  contentCampaignsApi: { getOne: vi.fn(), approve: vi.fn(), remove: vi.fn() },
}));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: () => perms.canApprove, isSuperAdmin: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/components/ConfirmModal", () => ({ confirmModal: vi.fn() }));
vi.mock("@/hooks/useTenant", () => ({ useTenant: () => ({}) }));
vi.mock("@/hooks/useWorkspace", () => ({ useWorkspace: () => ({}) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({}) }));
vi.mock("@/services/tour.service", () => ({ TourService: {} }));
vi.mock("@/components/form/FormFieldAi", () => ({ FormFieldAi: () => null }));
vi.mock("@/components/content/MultiPlatformPicker", () => ({ MultiPlatformPicker: () => null }));

const campaign = {
  id: "c1",
  name: "Launch",
  postCount: 2,
  status: "review",
  created_at: "2026-11-01T00:00:00Z",
};

async function show(onChanged = vi.fn(), status = "review") {
  render(
    <MemoryRouter>
      <CampaignCard campaign={{ ...campaign, status }} tenantId="t1" onChanged={onChanged} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getAllByRole("button")[0]);
  return onChanged;
}

describe("CampaignCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    perms.canApprove = true;
    vi.mocked(contentCampaignsApi.getOne).mockResolvedValue({
      campaign: {},
      posts: [{ id: "p1", title: "First", content: "<p>x</p>", status: "draft", scheduledDate: "2026-12-01" }],
    });
    vi.mocked(contentCampaignsApi.approve).mockResolvedValue({ approved: 2, shiftedDays: 0 });
  });

  it("marks a new campaign for review and links each draft to the editor", async () => {
    await show();
    expect(screen.getByText("Needs review")).toBeTruthy();
    const edit = await screen.findByRole("link", { name: "Edit post" });
    expect(edit.getAttribute("href")).toBe("/content/edit/p1");
    expect(screen.getByText(/Nothing goes out until/)).toBeTruthy();
  });

  it("does nothing until approval is confirmed", async () => {
    vi.mocked(confirmModal).mockResolvedValue(false);
    await show();
    fireEvent.click(await screen.findByRole("button", { name: "Approve and schedule" }));
    await waitFor(() => expect(confirmModal).toHaveBeenCalled());
    expect(contentCampaignsApi.approve).not.toHaveBeenCalled();
  });

  it("approves after confirmation and refreshes the list", async () => {
    vi.mocked(confirmModal).mockResolvedValue(true);
    const onChanged = await show();
    fireEvent.click(await screen.findByRole("button", { name: "Approve and schedule" }));
    await waitFor(() => expect(contentCampaignsApi.approve).toHaveBeenCalledWith("c1", "t1"));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("tells the user when the series moved forward", async () => {
    vi.mocked(confirmModal).mockResolvedValue(true);
    vi.mocked(contentCampaignsApi.approve).mockResolvedValue({ approved: 2, shiftedDays: 3 });
    await show();
    fireEvent.click(await screen.findByRole("button", { name: "Approve and schedule" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining("3 days") })),
    );
  });

  it("hides approval from people without permission", async () => {
    perms.canApprove = false;
    await show();
    expect(await screen.findByText(/Ask someone with approval access/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve and schedule" })).toBeNull();
  });

  it("shows an approved campaign as scheduled, with no approve button", async () => {
    await show(vi.fn(), "active");
    expect(screen.getByText("Scheduled")).toBeTruthy();
    await screen.findByText("First");
    expect(screen.queryByRole("button", { name: "Approve and schedule" })).toBeNull();
  });
});
