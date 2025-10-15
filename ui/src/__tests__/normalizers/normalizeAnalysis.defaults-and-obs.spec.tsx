import { describe, expect, it } from "vitest";
import { normalizeAnalysis } from "../../utils/analysis";

describe("normalizeAnalysis — defaults and obs counting contract", () => {
  it("returns canonical empty structure when input is null-like", () => {
    const normalized = normalizeAnalysis(null);
    expect(normalized.summary).toBeUndefined();
    expect(normalized.receipts).toEqual([]);
    expect(normalized.copywriting.guidance).toEqual([]);
    expect(normalized.heuristics).toEqual([]);
    expect(normalized.obsCount).toBeUndefined();
  });

  it("counts OBS tokens across nested structures", () => {
    const raw = {
      summary: "OBS-12 observed on primary CTA.",
      psychology: [
        {
          title: "Loss Aversion Messaging",
          summary: "OBS-9 combines with OBS-12 in modal copy.",
          sources: []
        }
      ],
      recommendations: ["Prioritize OBS-9 mitigation"]
    } as unknown;

    const normalized = normalizeAnalysis(raw);
    expect(normalized.obsCount).toBe(4);
  });
});
