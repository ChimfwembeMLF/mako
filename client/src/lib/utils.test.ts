import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("keeps a text colour next to a custom font size", () => {
    expect(cn("text-primary-foreground", "text-button-sm")).toBe("text-primary-foreground text-button-sm");
  });

  it("lets a later custom font size replace an earlier one", () => {
    expect(cn("text-button-md", "text-button-sm")).toBe("text-button-sm");
  });

  it("still resolves conflicting colours", () => {
    expect(cn("text-red-500", "text-primary-foreground")).toBe("text-primary-foreground");
  });
});
