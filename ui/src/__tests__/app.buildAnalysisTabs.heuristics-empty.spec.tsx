import { describe, expect, it } from "vitest";
import type { StructuredAnalysis } from "../utils/analysis";
import { buildAnalysisTabs } from "../app/buildAnalysisTabs";

const BASE_ANALYSIS: StructuredAnalysis = {
  summary: undefined,
  scopeNote: undefined,
  receipts: [],
  copywriting: {
    heading: undefined,
    summary: undefined,
    sections: [],
    guidance: [],
    sources: []
  },
  accessibilityExtras: {
    guardrails: [],
    contrastScore: undefined,
    summary: undefined,
    issues: [],
    recommendations: [],
    sources: []
  },
  heuristics: [],
  accessibility: [],
  psychology: [],
  impact: [],
  recommendations: [],
  contentType: undefined,
  flows: [],
  industries: [],
  uiElements: [],
  psychologyTags: [],
  suggestedTitle: undefined,
  suggestedTags: [],
  suggestedCollection: undefined,
  confidence: undefined,
  obsCount: undefined,
  promptVersion: undefined,
  uxSignals: [],
  heuristicScorecard: { strengths: [], weaknesses: [], opportunities: [] }
};

function makeAnalysis(overrides: Partial<StructuredAnalysis>): StructuredAnalysis {
  return {
    ...BASE_ANALYSIS,
    ...overrides,
    copywriting: {
      ...BASE_ANALYSIS.copywriting,
      ...(overrides.copywriting ?? {})
    },
    accessibilityExtras: {
      ...BASE_ANALYSIS.accessibilityExtras,
      ...(overrides.accessibilityExtras ?? {})
    }
  };
}

describe("buildAnalysisTabs — heuristics gating", () => {
  it("treats heuristics without descriptive content as empty", () => {
    const structured = makeAnalysis({
      heuristics: [
        { title: "Visibility of system status" },
        { title: "Match between system and the real world" },
        { title: "Error prevention" }
      ]
    });

    const tabs = buildAnalysisTabs(structured);
    const heuristicsTab = tabs.find((tab) => tab.id === "heuristics");

    expect(heuristicsTab?.hasContent).toBe(false);
    expect(heuristicsTab?.render()).toBeNull();
  });

  it("leaves heuristics tab enabled when at least one item has content", () => {
    const structured = makeAnalysis({
      heuristics: [
        { title: "Visibility of system status" },
        {
          title: "Error prevention",
          description: "Surface missing confirmation copy to reduce user confusion."
        }
      ]
    });

    const tabs = buildAnalysisTabs(structured);
    const heuristicsTab = tabs.find((tab) => tab.id === "heuristics");

    expect(heuristicsTab?.hasContent).toBe(true);
    expect(heuristicsTab?.render()).not.toBeNull();
  });
});
