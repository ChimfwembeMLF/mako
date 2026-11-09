import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { FormFieldAi } from "./FormFieldAi";
import { cleanIdea } from "@/lib/clean-idea";

const ai = vi.hoisted(() => ({
  result: "AI wrote this" as string | null,
  ideas: ["Small-batch coffee from Lusaka", "Fresh beans every week", "Direct trade", "A fourth idea"],
}));
const toast = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/hooks/useFieldEnhance", () => ({
  useFieldEnhance: () => ({
    enhancingKey: null,
    enhanceField: vi.fn(async (_key: string, _value: string, apply: (t: string) => void) => {
      if (ai.result === null) return false;
      apply(ai.result);
      return true;
    }),
  }),
}));
vi.mock("@/hooks/useFormSuggestions", () => ({
  useFormSuggestions: ({ values }: { values: Record<string, string> }) => ({
    loading: false,
    fetchSuggestions: vi.fn(),
    refreshSuggestions: vi.fn(),
    pauseField: vi.fn(),
    getSuggestionsForField: (key: string) => (values[key]?.trim() ? [] : ai.ideas),
  }),
}));

function Field({ initial = "", type = "textarea" as const }: { initial?: string; type?: "input" | "textarea" }) {
  const [value, setValue] = useState(initial);
  return (
    <FormFieldAi id="f" form="brand-brain" tenantId="t1" fieldKey="description" type={type} value={value} onChange={setValue} />
  );
}

describe("FormFieldAi", () => {
  beforeEach(() => {
    ai.result = "AI wrote this";
    toast.mockClear();
  });

  it("offers to write an empty field and to improve a filled one", () => {
    const { unmount } = render(<Field />);
    expect(screen.getByRole("button", { name: "Write it with AI" })).toBeInTheDocument();
    unmount();
    render(<Field initial="Some text" />);
    expect(screen.getByRole("button", { name: "Improve with AI" })).toBeInTheDocument();
  });

  it("shows up to three ideas under an empty field and fills it from one", () => {
    render(<Field />);
    const chips = screen.getAllByTitle(/coffee|beans|trade|fourth/);
    expect(chips).toHaveLength(3);
    fireEvent.click(screen.getByTitle("Fresh beans every week"));
    expect(screen.getByRole("textbox")).toHaveValue("Fresh beans every week");
    expect(screen.queryByTitle("Direct trade")).not.toBeInTheDocument();
  });

  it("can undo what AI wrote", async () => {
    render(<Field initial="My own words" />);
    fireEvent.click(screen.getByRole("button", { name: "Improve with AI" }));
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("AI wrote this"));
    fireEvent.click(screen.getByRole("button", { name: /Undo/ }));
    expect(screen.getByRole("textbox")).toHaveValue("My own words");
    expect(screen.queryByRole("button", { name: /Undo/ })).not.toBeInTheDocument();
  });

  it("drops the undo once you edit the AI text", async () => {
    render(<Field initial="Mine" />);
    fireEvent.click(screen.getByRole("button", { name: "Improve with AI" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Undo/ })).toBeInTheDocument());
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "AI wrote this, edited" } });
    expect(screen.queryByRole("button", { name: /Undo/ })).not.toBeInTheDocument();
  });

  it("says so when AI fails instead of doing nothing", async () => {
    ai.result = null;
    render(<Field initial="Mine" />);
    fireEvent.click(screen.getByRole("button", { name: "Improve with AI" }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })));
    expect(screen.getByRole("textbox")).toHaveValue("Mine");
  });

  it("strips Markdown from ideas", () => {
    expect(cleanIdea("- **'Smell This'**: Which coffee smells better?")).toBe("Smell This: Which coffee smells better?");
    expect(cleanIdea("1. **Meet the Farmer** – a grower spotlight")).toBe("Meet the Farmer – a grower spotlight");
    expect(cleanIdea("Your Morning Cup Just Got a Zambian Upgrade")).toBe("Your Morning Cup Just Got a Zambian Upgrade");
    expect(cleanIdea("Q&A: **Ask a Barista**")).toBe("Q&A: Ask a Barista");
    expect(cleanIdea("Your Office Coffee's Got a *Story*—Here's Yours")).toBe("Your Office Coffee's Got a Story—Here's Yours");
    expect(cleanIdea("Fresh Coffee? We Do It *Every Week*. (And So Can You.)")).toBe("Fresh Coffee? We Do It Every Week. (And So Can You.)");
  });
});
