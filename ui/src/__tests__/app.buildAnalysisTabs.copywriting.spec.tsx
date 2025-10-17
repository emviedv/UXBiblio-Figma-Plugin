import { describe, expect, it } from "vitest";
import { buildAnalysisTabs } from "../app/buildAnalysisTabs";
import type { StructuredAnalysis } from "../utils/analysis";

const EMPTY_ANALYSIS: StructuredAnalysis = {
  summary: undefined,
  scopeNote: undefined,
  receipts: [],
  copywriting: { heading: undefined, summary: undefined, sections: [], guidance: [], sources: [] },
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
  flows: [],
  industries: [],
  uiElements: [],
  psychologyTags: [],
  suggestedTags: [],
  uxSignals: [],
  heuristicScorecard: { strengths: [], weaknesses: [], opportunities: [] }
};

describe("buildAnalysisTabs copywriting gating", () => {
  it("treats a heading-only copywriting payload as available content", () => {
    const tabs = buildAnalysisTabs({
      ...EMPTY_ANALYSIS,
      copywriting: {
        heading: "Guarantee Messaging",
        summary: undefined,
        sections: [],
        guidance: [],
        sources: []
      }
    });

    const copyTab = tabs.find((tab) => tab.id === "ux-copywriting");
    expect(copyTab?.hasContent).toBe(true);
  });
});
