import { describe, it, expect, beforeAll, vi } from "vitest";
import { normalizeAnalysis } from "../../utils/analysis";

describe("normalizeAnalysis — heuristic 'Recommendation:' aggregated into next steps", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation((...args) => {
      throw new Error("Unexpected console.error: " + args.join(" "));
    });
  });

  it("extracts 'Recommendation:' lines when present", () => {
    const raw = {
      heuristics: [
        {
          name: "Error Prevention",
          description: "Risk: users may mistype inputs.\nRecommendation: Add inline constraints and examples.",
          score: 2
        }
      ]
    } as unknown;

    const normalized = normalizeAnalysis(raw);
    expect(normalized.recommendations).toEqual(
      expect.arrayContaining([expect.stringContaining("Add inline constraints and examples")])
    );
  });
});

