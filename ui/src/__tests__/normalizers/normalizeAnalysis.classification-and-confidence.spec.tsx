import { describe, it, expect, beforeAll, vi } from "vitest";
import { normalizeAnalysis } from "../../utils/analysis";

describe("normalizeAnalysis — classification + confidence mapping", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation((...args) => {
      throw new Error("Unexpected console.error: " + args.join(" "));
    });
  });

  it("maps classification fields and confidence", () => {
    const raw = {
      contentType: "ui-screen",
      flows: ["onboarding", "likely:signup"],
      industries: ["Software as a Service"],
      uiElements: ["Call to Action", "Pop-ups & Modals"],
      psychologyTags: ["Curiosity Gap"],
      suggestedTitle: "Signup modal highlights CTA clarity",
      suggestedTags: ["flow:onboarding", "wcag-contrast", "default-bias"],
      suggestedCollection: "Flows",
      confidence: { level: "high", rationale: "Strong visual evidence across OBS anchors." }
    } as unknown;

    const normalized = normalizeAnalysis(raw);
    expect((normalized as any).contentType).toBe("ui-screen");
    expect((normalized as any).flows).toEqual(["onboarding", "likely:signup"]);
    expect((normalized as any).confidence?.level).toBe("high");
  });
});

