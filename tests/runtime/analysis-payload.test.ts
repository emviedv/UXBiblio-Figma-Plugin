import { describe, expect, it } from "vitest";
import { prepareAnalysisPayload } from "../../src/utils/analysis-payload";

const BASE_CONTEXT = {
  selectionName: "Frame 1",
  exportedAt: "2024-01-01T00:00:00.000Z"
};

describe("prepareAnalysisPayload", () => {
  it("flattens analysis object returned by the analysis proxy", () => {
    const payload = prepareAnalysisPayload(
      {
        selectionName: "Frame 1",
        analysis: {
          heuristics: [{ title: "Spacing" }],
          impact: [],
          accessibility: [],
          psychology: [],
          recommendations: []
        },
        metadata: { model: "gpt", usage: { total_tokens: 1200 } }
      },
      BASE_CONTEXT
    );

    expect(payload.analysis).toEqual({
      heuristics: [{ title: "Spacing" }],
      impact: [],
      accessibility: [],
      psychology: [],
      recommendations: []
    });
    expect(payload.metadata).toEqual({ model: "gpt", usage: { total_tokens: 1200 } });
  });

  it("preserves legacy payloads without nested metadata", () => {
    const payload = prepareAnalysisPayload(
      {
        heuristics: [],
        accessibility: [],
        psychology: [],
        impact: [],
        recommendations: []
      },
      BASE_CONTEXT
    );

    expect(payload.analysis).toEqual({
      heuristics: [],
      accessibility: [],
      psychology: [],
      impact: [],
      recommendations: []
    });
    expect(payload.metadata).toBeUndefined();
  });
});
