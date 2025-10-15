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
