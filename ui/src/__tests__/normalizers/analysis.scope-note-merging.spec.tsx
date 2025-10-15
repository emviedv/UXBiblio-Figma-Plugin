import { describe, expect, it } from "vitest";
import { normalizeAnalysis } from "../../utils/analysis";

describe("normalizeAnalysis — scope note merging", () => {
  it("stores scope note separately while merging into summary", () => {
    const scopeNote =
      "This screen shows a pricing decision point with the annual plan pre-selected and upgrade prompts along the right rail.";
    const summary =
      "Users weigh the annual upgrade while comparing plan tiers; reassure pricing and clarify the trial cut-off.";

    const normalized = normalizeAnalysis({
      scopeNote,
      summary
    });

    expect(normalized.scopeNote).toBe(scopeNote);
    expect(normalized.summary).toContain(scopeNote);
    expect(normalized.summary).toContain(summary);
    expect(normalized.summary?.indexOf(scopeNote)).toBe(0);
  });

  it("falls back to scope note when summary is missing", () => {
    const scopeNote =
      "The upgrade modal is partially completed and awaits confirmation; primary CTA tone feels high urgency.";

    const normalized = normalizeAnalysis({
      scopeNote
    });

    expect(normalized.scopeNote).toBe(scopeNote);
    expect(normalized.summary).toBe(scopeNote);
  });
});
