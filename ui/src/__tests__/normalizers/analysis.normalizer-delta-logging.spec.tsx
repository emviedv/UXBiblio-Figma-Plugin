import { describe, it, expect, afterEach, vi } from "vitest";
import { logger } from "@shared/utils/logger";
import { normalizeAnalysis } from "../../utils/analysis";

type DeltaPayload = {
  rawKeys: string[];
  unknownKeys?: string[];
  rawHeuristics: number | null;
  rawPsych: number | null;
  rawImpactAreas: number | null;
  rawReceipts: number | null;
  rawCopyGuidance: number | null;
  rawCopySources: number | null;
  heuristics: number;
  psychology: number;
  impact: number;
  recommendations: number;
  receipts: number;
  copyGuidance: number;
  copySources: number;
  hasSummary: boolean;
  hasCopySummary: boolean;
  promptVersion: string | null;
};

describe("normalizeAnalysis — delta logging contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits raw vs structured delta diagnostics with unknown keys surfaced", () => {
    const debugSpy = vi.spyOn(logger, "debug").mockImplementation(() => undefined);
    vi.spyOn(logger, "warn").mockImplementation(() => undefined);

    const raw = {
      summary: "Primary CTA lacks contrast and clarity.",
      scopeNote: "Focus on onboarding conversion screen.",
      heuristics: [
        {
          title: "Visibility of system status",
          description: "Users should immediately understand field states.",
          sources: [{ title: "NNG Principles", url: "https://example.org/visibility" }]
        }
      ],
      psychology: [
        {
          title: "Curiosity Gap — Intentional",
          description: "Leans on curiosity to nudge completion.",
          sources: []
        }
      ],
      impact: {
        summary: "Potential conversion uplift by clarifying CTA hierarchy.",
        areas: [
          {
            category: "Conversion",
            severity: "high",
            summary: "CTA is visually buried beneath secondary links.",
            recommendations: ["Lift CTA above fold", "Increase contrast ratio"]
          }
        ]
      },
      accessibility: {
        summary: "CTA contrast fails WCAG AA thresholds.",
        recommendations: ["Increase contrast on CTA"],
        issues: ["CTA contrast is insufficient"],
        sources: [{ title: "WCAG 1.4.3", url: "https://www.w3.org/TR/WCAG21/#contrast-minimum" }],
        contrastScore: 0.24,
        contrastStatus: "failing"
      },
      recommendations: [
        "Elevate primary CTA [Impact:High][Effort:Medium][Refs:heuristics[1], WCAG 1.4.3]"
      ],
      receipts: [
        {
          title: "Primary CTA benchmark",
          url: "https://example.org/research"
        }
      ],
      uxCopywriting: {
        heading: "Join today",
        summary: "Short and clear benefit statement.",
        guidance: ["Use active verbs", "Highlight the key differentiator"],
        sources: ["Internal voice doc"]
      },
      metadata: {
        flows: ["Onboarding"],
        industries: ["SaaS"],
        uiElements: ["Call to Action"],
        psychologyTags: ["Curiosity Gap"],
        suggestedTags: ["wcag-1-4-3"],
        suggestedCollection: "Flows"
      },
      uxSignals: ["High confidence"],
      confidence: { level: "medium", rationale: "OBS-1" },
      promptVersion: "2025.02",
      unexpectedFlag: "schema drift sentinel"
    } as const;

    const normalized = normalizeAnalysis(raw);

    const deltaCall = debugSpy.mock.calls.find(
      ([message]) => message === "[AnalysisNormalizer][Delta] Raw vs Structured counts"
    );

    expect(deltaCall, "delta diagnostic should fire exactly once").toBeTruthy();
    const [, detail] = deltaCall as [string, DeltaPayload];
    expect(detail).toBeTruthy();

    expect(Array.isArray(detail.rawKeys)).toBe(true);
    expect(detail.rawKeys).toEqual(
      expect.arrayContaining([
        "summary",
        "scopeNote",
        "heuristics",
        "psychology",
        "impact",
        "accessibility",
        "recommendations",
        "receipts",
        "uxCopywriting",
        "metadata",
        "uxSignals",
        "confidence",
        "promptVersion",
        "unexpectedFlag"
      ])
    );

    expect(detail.unknownKeys).toEqual(["unexpectedFlag"]);
    expect(detail.rawHeuristics).toBe(1);
    expect(detail.rawPsych).toBe(1);
    expect(detail.rawImpactAreas).toBe(1);
    expect(detail.rawReceipts).toBe(1);
    expect(detail.rawCopyGuidance).toBe(2);
    expect(detail.rawCopySources).toBe(1);

    expect(detail.heuristics).toBe(normalized.heuristics.length);
    expect(detail.psychology).toBe(normalized.psychology.length);
    expect(detail.impact).toBe(normalized.impact.length);
    expect(detail.recommendations).toBe(normalized.recommendations.length);
    expect(detail.receipts).toBe(normalized.receipts.length);
    expect(detail.copyGuidance).toBe(normalized.copywriting.guidance.length);
    expect(detail.copySources).toBe(normalized.copywriting.sources.length);
    expect(detail.hasSummary).toBe(true);
    expect(detail.hasCopySummary).toBe(true);
    expect(detail.promptVersion).toBe("2025.02");
  });
});
