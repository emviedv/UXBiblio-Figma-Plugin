import { describe, expect, it } from "vitest";
import { extractAnalysisData } from "../../utils/analysis";

describe("extractAnalysisData — payload contract", () => {
  it("short-circuits to original object when heuristic arrays already present", () => {
    const alreadyNormalized = { heuristics: [], accessibility: [], recommendations: [] };
    expect(extractAnalysisData(alreadyNormalized)).toBe(alreadyNormalized);
  });

  it("unwraps nested analysis objects while retaining reference integrity", () => {
    const inner = { summary: "OBS-101 highlights layout issues" };
    const payload = { analysis: inner, meta: { id: "frame-55" } };
    const extracted = extractAnalysisData(payload);
    expect(extracted).toBe(inner);
  });
});
