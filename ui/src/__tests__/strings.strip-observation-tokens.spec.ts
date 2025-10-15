import { describe, expect, it } from "vitest";
import { stripObservationTokens } from "../utils/strings";

describe("stripObservationTokens", () => {
  it("removes observation anchors without leaving orphan separators", () => {
    const input = "(OBS-1, OBS-4 | flow:onboarding) Primary CTA uses amber highlight.";
    const output = stripObservationTokens(input);
    expect(output).toBe("(flow:onboarding) Primary CTA uses amber highlight.");
  });

  it("drops empty parentheses created by anchor removal", () => {
    const input = "Resulting state (OBS-2, OBS-3) shows no confirmations.";
    const output = stripObservationTokens(input);
    expect(output).toBe("Resulting state shows no confirmations.");
  });
});
