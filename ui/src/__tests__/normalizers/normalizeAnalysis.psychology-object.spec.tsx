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

  it("uses technique and trigger fields for titles when explicit names are missing", () => {
    const raw = {
      psychology: {
        persuasionTechniques: [
          {
            technique: "Social Proof",
            summary: "Testimonials highlight adoption.",
            recommendations: ["Surface recent wins within hero area."]
          }
        ],
        behavioralTriggers: [
          {
            trigger: "Trial Benefits",
            summary: "Emphasizes savings during free trial.",
            signals: ["Intro modal lists core benefits."]
          }
        ]
      }
    } as unknown;

    const normalized = normalizeAnalysis(raw);

    const socialProof = normalized.psychology.find((item) => item.description?.includes("Testimonials"));
    expect(socialProof?.title).toBe("Social Proof");
    expect(socialProof?.description).toContain("Testimonials highlight adoption.");

    const trialBenefits = normalized.psychology.find((item) =>
      item.description?.includes("Emphasizes savings")
    );
    expect(trialBenefits?.title).toBe("Trial Benefits");
    expect(trialBenefits?.description).toContain("Intro modal lists core benefits.");
  });

  it("merges nested details objects into the psychology description", () => {
    const raw = {
      psychology: {
        behavioralTriggers: [
          {
            trigger: "Trust",
            details: {
              summary: "OBS-8, OBS-11 — Trial CTA buries reassurance copy so trust never builds.",
              signals: ["Security badges hidden behind accordion"]
            }
          }
        ]
      }
    } as unknown;

    const normalized = normalizeAnalysis(raw);
    const trust = normalized.psychology.find((item) => item.title === "Trust");

    expect(trust).toBeDefined();
    expect(trust?.description).toContain("Trial CTA buries reassurance copy so trust never builds.");
    expect(trust?.description).toContain("Signals: Security badges hidden behind accordion");
    expect(trust?.metadata).toBeUndefined();
  });

  it("preserves guardrail-labeled summaries as narrative while extracting metadata", () => {
    const raw = {
      psychology: {
        behavioralTriggers: [
          {
            trigger: "Commitment",
            summary: "Guardrail: Reinforce trust before the CTA."
          }
        ]
      }
    } as unknown;

    const normalized = normalizeAnalysis(raw);
    const commitment = normalized.psychology.find((item) => item.title === "Commitment");

    expect(commitment).toBeDefined();
    expect(commitment?.description).toBe("Reinforce trust before the CTA.");
    expect(commitment?.metadata?.guardrail).toEqual(["Reinforce trust before the CTA."]);
  });
});
