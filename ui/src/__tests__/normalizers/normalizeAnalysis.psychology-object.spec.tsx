import { describe, expect, it } from "vitest";
import { normalizeAnalysis } from "../../utils/analysis";

describe("normalizeAnalysis — psychology keyed object compatibility", () => {
  it("extracts persuasion techniques when provided as a keyed object", () => {
    const raw = {
      psychology: {
        persuasionTechniques: {
          defaultBias: {
            title: "Default Bias Reinforcement",
            summary: "OBS-4, OBS-7 — Primary CTA is visually dominant.",
            intent: "intentional",
            recommendations: ["Surface opt-out copy near the CTA."],
            signals: ["Dominant CTA color", "Preselected option"]
          }
        },
        behavioralTriggers: {
          lossAversion: {
            summary: "OBS-8, OBS-9 — Countdown timer creates urgency.",
            intent: "risky",
            recommendations: ["Clarify inventory messaging to avoid deception."],
            signals: ["Limited stock badge"]
          }
        }
      }
    } as unknown;

    const normalized = normalizeAnalysis(raw);
    const defaultBias = normalized.psychology.find(
      (item) => item.title === "Default Bias Reinforcement"
    );
    const lossAversion = normalized.psychology.find((item) => item.title === "Loss Aversion");

    expect(defaultBias).toBeDefined();
    expect(defaultBias?.description).toBeDefined();
    expect(defaultBias?.description ?? "").toContain("Primary CTA is visually dominant.");
    expect(defaultBias?.description ?? "").toContain(
      "Signals: Dominant CTA color, Preselected option"
    );
    expect(defaultBias?.severity).toBe("intentional");

    expect(lossAversion).toBeDefined();
    expect(lossAversion?.description).toBeDefined();
    expect(lossAversion?.description ?? "").toContain("Countdown timer creates urgency.");
    expect(lossAversion?.description ?? "").toContain(
      "Next Steps: Clarify inventory messaging to avoid deception."
    );
    expect(lossAversion?.severity).toBe("risky");
  });
});
