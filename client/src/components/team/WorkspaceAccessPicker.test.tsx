import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { WorkspaceAccessPicker } from "./WorkspaceAccessPicker";

const WS = [
  { id: "a", name: "Coffee & Co" },
  { id: "b", name: "Bakery" },
];

function Picker({ initial = null as string[] | null, allowAll = true, onChange = vi.fn() }) {
  const [value, setValue] = useState<string[] | null>(initial);
  return (
    <WorkspaceAccessPicker
      workspaces={WS}
      value={value}
      allowAll={allowAll}
      defaultSelection={["b"]}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

describe("WorkspaceAccessPicker", () => {
  it("switching to 'Only these' starts with the current workspace", () => {
    const onChange = vi.fn();
    render(<Picker onChange={onChange} />);
    fireEvent.click(screen.getByText("Only these workspaces"));
    expect(onChange).toHaveBeenLastCalledWith(["b"]);
    expect(screen.getByRole("button", { name: /Bakery/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps a hand-picked list even when every workspace is ticked", () => {
    const onChange = vi.fn();
    render(<Picker initial={["b"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Coffee & Co/ }));
    // Not null: new workspaces should not be added to this person's access by accident.
    expect(onChange).toHaveBeenLastCalledWith(["b", "a"]);
  });

  it("asks for at least one workspace when none are ticked", () => {
    render(<Picker initial={["b"]} />);
    fireEvent.click(screen.getByRole("button", { name: /Bakery/ }));
    expect(screen.getByText("Pick at least one.")).toBeInTheDocument();
  });

  it("hides 'All workspaces' from someone who is limited themselves", () => {
    render(<Picker initial={["a"]} allowAll={false} />);
    expect(screen.queryByText("All workspaces")).not.toBeInTheDocument();
  });

  it("explains that 'All workspaces' includes ones added later", () => {
    render(<Picker />);
    expect(screen.getByRole("radio", { name: /All workspaces/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/added later/)).toBeInTheDocument();
  });
});
