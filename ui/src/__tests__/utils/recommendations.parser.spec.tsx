import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { normalizeRecommendations } from "../../utils/analysis/recommendations";

describe("normalizeRecommendations metadata handling", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      throw new Error(`console.error called: ${String(args.join(" "))}`);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("preserves impact/effort/refs meta blocks for UI chips", () => {
    const out = normalizeRecommendations([
      "[impact:medium][effort:low][Refs: heuristics[9], impact:Anxiety] Restore a visible focus indicator on the primary CTA."
    ]);
    expect(out.length).toBe(1);
    expect(out[0]).toContain("[impact:medium]");
    expect(out[0]).toContain("[effort:low]");
    expect(out[0]).toContain("[Refs:");
    expect(out[0]).toContain("Restore a visible focus indicator on the primary CTA.");
  });
});
