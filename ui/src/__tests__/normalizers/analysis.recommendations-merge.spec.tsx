import { describe, expect, it, beforeAll, vi } from "vitest";
import { normalizeAnalysis } from "../../utils/analysis";

describe("normalizeAnalysis — merged recommendations stay unique and ordered", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation((...args) => {
      throw new Error("Unexpected console.error: " + args.join(" "));
    });
  });

  it("deduplicates strings pulled from sections and keeps canonical ordering", () => {
    const raw = {
      summary: "OBS-11 uncovered repeated CTA friction.",
      recommendations: ["Test CTA copy", "Improve CTA contrast"],
      heuristics: [
        {
          name: "Consistency and standards",
          recommendations: ["Test CTA copy", "OBS-372 Document panel"]
        }
      ],
      impact: {
        areas: [
          {
            category: "Conversion",
            summary: "OBS-99: CTA contrast is low.",
            recommendations: ["Improve CTA contrast"]
          }
        ]
      },
      accessibility: {
        recommendations: ["Improve CTA contrast", "Elevate alt text"]
      },
      psychology: {
        persuasionTechniques: [
          {
            title: "Social proof",
            summary: "OBS-200 shows reliance on badges.",
            recommendations: ["Create time-limited offer"]
          }
        ],
        behavioralTriggers: []
      }
    } as unknown;

    const normalized = normalizeAnalysis(raw);
    expect(normalized.obsCount).toBe(4);
    expect(normalized.recommendations).toEqual([
      "Test CTA copy",
      "Improve CTA contrast",
      "Create time-limited offer",
      "Document panel",
      "Elevate alt text"
    ]);
  });
});
