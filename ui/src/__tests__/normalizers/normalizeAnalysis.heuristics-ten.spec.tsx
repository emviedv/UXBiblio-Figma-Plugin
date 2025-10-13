import { describe, it, expect, beforeAll, vi } from "vitest";
import { normalizeAnalysis } from "../../utils/analysis";

describe("normalizeAnalysis — ensures all 10 heuristics surface", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation((...args) => {
      throw new Error("Unexpected console.error: " + args.join(" "));
    });
  });

  it("appends missing canonical heuristics when partial list is returned", () => {
    const raw = {
      heuristics: [
        { name: "Consistency and standards", description: "Use platform conventions." },
        { name: "Error prevention" }
      ]
    } as unknown;

    const normalized = normalizeAnalysis(raw);
    // Expect at least 10 items with canonical names present
    expect(normalized.heuristics.length).toBeGreaterThanOrEqual(10);

    const titles = new Set(normalized.heuristics.map((h) => h.title));
    const mustHave = [
      "Visibility of system status",
      "Match between system and the real world",
      "User control and freedom",
      "Consistency and standards",
      "Error prevention",
      "Recognition rather than recall",
      "Flexibility and efficiency of use",
      "Aesthetic and minimalist design",
      "Help users recognize, diagnose, and recover from errors",
      "Help and documentation"
    ];
    for (const name of mustHave) {
      expect(titles.has(name)).toBe(true);
    }
  });
});

