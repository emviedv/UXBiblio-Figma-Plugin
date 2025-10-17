import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeAnalysis } from "../../utils/analysis";

let originalConsoleError: typeof console.error;

describe("normalizeAnalysis — uxSignals support", () => {
  beforeEach(() => {
    originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      originalConsoleError?.(...args);
      throw new Error(
        `Unexpected console.error in normalizeAnalysis.uxsignals.spec.tsx: ${args
          .map((value) => String(value))
          .join(" ")}`
      );
    };
  });

  afterEach(() => {
    console.error = originalConsoleError;
    vi.restoreAllMocks();
  });

  it("collects uxSignals strings from the analysis payload", () => {
    const result = normalizeAnalysis({
      summary: "OBS-1 describes the empty state, OBS-2 captures CTA prominence.",
      receipts: [],
      uxSignals: ["Subscription blocker", "Delight opportunity"],
      heuristics: [],
      accessibility: [],
      psychology: [],
      impact: [],
      recommendations: []
    });

    expect(result.uxSignals).toEqual(["Subscription blocker", "Delight opportunity"]);
  });

  it("deduplicates and limits uxSignals to 6 entries", () => {
    const result = normalizeAnalysis({
      summary: "OBS-1 enumerates top nav prompts.",
      receipts: [],
      uxSignals: [
        "Urgency cue",
        "Urgency cue",
        "Trust gap",
        "Enrollment friction",
        "Learning curve",
        "Habit reinforcement",
        "Retention risk",
        "Delight opportunity"
      ],
      heuristics: [],
      accessibility: [],
      psychology: [],
      impact: [],
      recommendations: []
    });

    expect(result.uxSignals).toEqual([
      "Urgency cue",
      "Trust gap",
      "Enrollment friction",
      "Learning curve",
      "Habit reinforcement",
      "Retention risk"
    ]);
  });
});
