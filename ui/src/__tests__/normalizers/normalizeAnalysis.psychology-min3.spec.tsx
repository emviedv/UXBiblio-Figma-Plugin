import { describe, it, expect, beforeAll, vi } from "vitest";
import { normalizeAnalysis } from "../../utils/analysis";

describe("normalizeAnalysis — psychology has at least 3 examples when present", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation((...args) => {
      throw new Error("Unexpected console.error: " + args.join(" "));
    });
  });

  it("tops up to 3 when fewer are returned", () => {
    const raw = {
      psychology: {
        persuasionTechniques: [
          { title: "Curiosity Gap", summary: "Teases value to motivate exploration.", intent: "Intentional" }
        ]
      }
    } as unknown;

    const normalized = normalizeAnalysis(raw);
    expect(normalized.psychology.length).toBeGreaterThanOrEqual(3);
  });
});

