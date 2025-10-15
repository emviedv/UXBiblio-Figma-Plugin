import { describe, expect, it } from "vitest";
import { extractAnalysisData } from "../../utils/analysis";

type Scenario = {
  label: string;
  value: unknown;
  expectedSelector: "analysis" | "self";
};

const scenarios: Scenario[] = [
  {
    label: "unwraps nested analysis payloads without altering data",
    value: {
      id: "frame-123",
      analysis: {
        summary: "OBS-9 highlights an issue",
        heuristics: [],
        recommendations: []
      },
      meta: { createdAt: "2025-10-15T12:00:00Z" }
    },
    expectedSelector: "analysis"
  },
  {
    label: "returns the original value when already normalized",
    value: {
      heuristics: [],
      accessibility: [],
      recommendations: []
    },
    expectedSelector: "self"
  }
];

describe("extractAnalysisData", () => {
  it.each(scenarios)("$label", ({ value, expectedSelector }) => {
    const result = extractAnalysisData(value);
    if (expectedSelector === "analysis") {
      const typed = value as { analysis: unknown };
      expect(result).toBe(typed.analysis);
    } else {
      expect(result).toBe(value);
    }
  });
});
