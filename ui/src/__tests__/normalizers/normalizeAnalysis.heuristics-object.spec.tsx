import { describe, expect, it } from "vitest";
import { normalizeAnalysis } from "../../utils/analysis";

describe("normalizeAnalysis — heuristics keyed object compatibility", () => {
  it("extracts heuristic insights when payload provides a keyed object", () => {
    const raw = {
      heuristics: {
        visibility: {
          name: "Visibility of system status",
          description: "OBS-1, OBS-2 — Provide immediate progress feedback.",
          score: 2,
          insights: ["Next Steps: Add a toast confirming sync completion."]
        },
        errorPrevention: {
          summary: "OBS-3, OBS-5 — Inputs allow invalid characters without guardrails.",
          score: 3,
          recommendations: ["Next Steps: Add inline validation."]
        }
      }
    } as unknown;

    const normalized = normalizeAnalysis(raw);
    const visibility = normalized.heuristics.find(
      (item) => item.title === "Visibility of system status"
    );
    const errorPrevention = normalized.heuristics.find(
      (item) => item.title === "Error prevention"
    );

    expect(visibility).toBeDefined();
    expect(visibility?.description).toBeDefined();
    expect(visibility?.description ?? "").toContain("Provide immediate progress feedback.");
    expect(visibility?.description ?? "").toContain(
      "Next Steps: Add a toast confirming sync completion."
    );
    expect(visibility?.severity).toBe("high");

    expect(errorPrevention).toBeDefined();
    expect(errorPrevention?.description).toBeDefined();
    expect(errorPrevention?.description ?? "").toContain(
      "Inputs allow invalid characters without guardrails."
    );
    expect(errorPrevention?.description ?? "").toContain("Next Steps: Add inline validation.");
    expect(errorPrevention?.severity).toBe("medium");
  });
});
