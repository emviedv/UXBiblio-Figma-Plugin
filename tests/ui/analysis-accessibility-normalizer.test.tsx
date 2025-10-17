import { describe, expect, it } from "vitest";
import { normalizeAccessibility } from "../../ui/src/utils/analysis/accessibility";

describe("normalizeAccessibility", () => {
  it("converts string arrays into analysis items", () => {
    const payload = [
      "OBS-3 Low contrast between CTA text and background.",
      "OBS-5 Missing focus indicator on primary action."
    ];

    const result = normalizeAccessibility(payload);

    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.description).toContain("Low contrast");
    expect(result.items[1]?.description).toContain("Missing focus");
  });
});

describe("normalizeAccessibility extras", () => {
  it("merges accessibilityCheck metadata into extras", () => {
    const payload = {
      issues: ["WCAG 2.2 1.4.3 - CTA below 4.5:1 (OBS-2)"],
      recommendations: ["Increase CTA text contrast to 4.5:1."],
      sources: []
    };

    const result = normalizeAccessibility(payload, {
      contrastScore: "fair",
      contrastStatus: "done",
      actionableRecommendation: "Raise CTA text color for 4.5:1 contrast."
    });

    expect(result.extras.contrastScore).toBe(3);
    expect(result.extras.contrastStatus).toBe("done");
    expect(result.extras.keyRecommendation).toContain("Raise CTA text color");
    expect(result.extras.recommendations).toContain("Increase CTA text contrast to 4.5:1.");
  });
});
