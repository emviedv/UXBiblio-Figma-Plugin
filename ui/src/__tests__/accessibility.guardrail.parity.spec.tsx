import { afterEach, describe, expect, it } from "vitest";
import {
  act,
  cleanupApp,
  dispatchPluginMessage,
  renderApp,
  tick
} from "../../../tests/ui/testHarness";

describe("Accessibility tab — guardrail parity", () => {
  afterEach(() => {
    cleanupApp();
  });

  it("surfaces guardrail badges from accessibilityCheck metadata", async () => {
    const container = renderApp();
    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: {
        selectionName: "Plan Upgrade Flow",
        exportedAt: "2025-10-18T15:21:00.000Z",
        analysis: {
          summary: "Accessibility parity target.",
          uxCopywriting: { heading: "", summary: "", guidance: [], sources: [] },
          accessibilityCheck: {
            contrastScore: 2.8,
            contrastStatus: "Needs WCAG 2.2 AA",
            actionableRecommendation: "Increase CTA text contrast.",
            guardrails: ["Keep skip links visible", "Maintain focus ring contrast"]
          },
          accessibility: {
            summary: "OBS-4 shows contrast 3.0:1 on CTA.",
            issues: ["CTA text contrast below 4.5:1"],
            recommendations: ["Adjust CTA text color for AA contrast."]
          },
          heuristics: [],
          psychology: [],
          impact: [],
          recommendations: []
        }
      }
    });

    await tick();

    const accessibilityTab = container.querySelector<HTMLButtonElement>("#analysis-tab-accessibility");
    expect(accessibilityTab, "Accessibility tab button should exist").not.toBeNull();
    await act(async () => {
      accessibilityTab!.click();
    });
    await tick();

    const guardrailChips = Array.from(
      container.querySelectorAll('[data-a11y-guardrail-chip="true"]')
    ).map((node) => node.textContent?.trim());

    expect(guardrailChips).toEqual([
      "Guardrail Keep skip links visible",
      "Guardrail Maintain focus ring contrast"
    ]);
  });
});
