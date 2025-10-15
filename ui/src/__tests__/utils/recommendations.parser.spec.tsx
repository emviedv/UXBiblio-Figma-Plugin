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

  it("strips nested bracket metadata and nested references", () => {
    expect(
      normalizeRecommendations([
        "[impact:medium][effort:low][Refs: heuristics[9], impact:Anxiety] Restore a visible focus indicator on the primary CTA."
      ])
    ).toEqual(["Restore a visible focus indicator on the primary CTA."]);
  });
});
