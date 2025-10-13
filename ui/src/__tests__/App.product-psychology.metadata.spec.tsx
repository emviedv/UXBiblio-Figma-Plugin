import { afterEach, describe, expect, it } from "vitest";
import {
  act,
  cleanupApp,
  dispatchPluginMessage,
  renderApp,
  tick
} from "../../../tests/ui/testHarness";

const PSYCHOLOGY_ANALYSIS_RESULT = {
  selectionName: "Library Homepage",
  exportedAt: "2025-03-19T19:30:00.000Z",
  analysis: {
    summary: "",
    receipts: [],
    uxCopywriting: {
      heading: "",
      summary: "",
      guidance: [],
      sources: []
    },
    heuristics: [],
    accessibility: [],
    psychology: [
      {
        title: "User Delight via Testimonials",
        description: [
          "Stage: discovery",
          "OBS-2 showcases positive user testimonials, enhancing trust and encouraging engagement.",
          "Guardrail: Ensure testimonials are authentic and relevant.",
          "Signals:",
          "- Social proof",
          "- User satisfaction",
          "Guardrail Recommendations:",
          "- Regularly update testimonials to reflect current user experiences."
        ].join("\n")
      }
    ],
    impact: [],
    recommendations: [],
    psychologyTags: [],
    industries: [],
    flows: [],
    uiElements: []
  }
};

afterEach(() => {
  cleanupApp();
});

describe("App Product Psychology tab", () => {
  it("suppresses normalization metadata and surfaces cleaned content with stage badge", async () => {
    const container = renderApp();

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: PSYCHOLOGY_ANALYSIS_RESULT
    });
    await tick();

    const psychologyTab = container.querySelector<HTMLButtonElement>("#analysis-tab-psychology");
    expect(psychologyTab).not.toBeNull();
    act(() => psychologyTab?.click());
    await tick();

    const panel = container.querySelector("#analysis-panel-psychology");
    expect(panel?.hasAttribute("hidden")).toBe(false);

    const stageBadge = panel?.querySelector('[data-badge-tone="stage"]');
    expect(stageBadge?.textContent?.trim()).toBe("Discovery");

    const signalItems = Array.from(
      panel?.querySelectorAll('[data-ux-section="psychology-signals"] li') ?? []
    ).map((node) => node.textContent?.trim());
    expect(signalItems).toEqual(["Social proof", "User satisfaction"]);

    const guardrailRecommendations = Array.from(
      panel?.querySelectorAll('[data-ux-section="psychology-guardrails"] li') ?? []
    ).map((node) => node.textContent?.trim());
    expect(guardrailRecommendations).toEqual([
      "Regularly update testimonials to reflect current user experiences."
    ]);

    const paragraphTexts = Array.from(panel?.querySelectorAll("p") ?? []).map((node) =>
      node.textContent?.trim()
    );
    expect(paragraphTexts.some((text) => text?.startsWith("Stage:"))).toBe(false);
    expect(paragraphTexts.some((text) => text?.startsWith("Guardrail:"))).toBe(false);
  });
});
