import { afterEach, describe, expect, it, vi } from "vitest";
import { isBrandVoiceStarted, onboardingGate } from "./onboarding-gate";

describe("isBrandVoiceStarted", () => {
  it("ignores the starter profile a new workspace gets", () => {
    expect(
      isBrandVoiceStarted({
        companyName: "Default",
        toneOfVoice: "Professional, clear, and friendly",
        brandPersonality: "Helpful and trustworthy",
      }),
    ).toBe(false);
  });

  it("counts a profile once the business is described", () => {
    expect(isBrandVoiceStarted({ companyName: "Acme", description: "We roast coffee" })).toBe(true);
    expect(isBrandVoiceStarted({ targetAudience: "Offices in Lusaka" })).toBe(true);
  });

  it("treats missing or blank profiles as not started", () => {
    expect(isBrandVoiceStarted(null)).toBe(false);
    expect(isBrandVoiceStarted({ description: "   " })).toBe(false);
  });
});

describe("onboardingGate", () => {
  afterEach(() => {
    onboardingGate.set("clear");
    vi.useRealTimers();
  });

  it("waits while the welcome is being checked, then reports the result", async () => {
    onboardingGate.set("checking");
    const result = onboardingGate.settled();
    onboardingGate.set("open");
    await expect(result).resolves.toBe("open");
  });

  it("does not keep a tour waiting forever", async () => {
    vi.useFakeTimers();
    onboardingGate.set("checking");
    const result = onboardingGate.settled(1000);
    vi.advanceTimersByTime(1000);
    await expect(result).resolves.toBe("clear");
  });
});
