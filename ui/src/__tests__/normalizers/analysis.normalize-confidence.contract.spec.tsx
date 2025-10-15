import { describe, expect, it } from "vitest";
import { normalizeAnalysis } from "../../utils/analysis";

describe("normalizeAnalysis — confidence contract", () => {
  it("omits confidence when fields are empty", () => {
    const normalized = normalizeAnalysis({ confidence: { level: "", rationale: "" } } as unknown);
    expect(normalized.confidence).toBeUndefined();
  });

  it("preserves confidence structure when provided", () => {
    const normalized = normalizeAnalysis({
      confidence: { level: "medium", rationale: "OBS-44 replicated twice." }
    } as unknown);

    expect(normalized.confidence).toEqual({ level: "medium", rationale: "replicated twice." });
  });
});
