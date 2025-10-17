import { afterEach, describe, expect, it } from "vitest";
import {
  act,
  cleanupApp,
  dispatchPluginMessage,
  renderApp,
  tick
} from "../../../tests/ui/testHarness";
import { normalizeAnalysis } from "../utils/analysis";

describe("Impact & Psychology parity chips", () => {
  afterEach(() => {
    cleanupApp();
  });

  it("renders impact severity/effort/reference chips and psychology intent/guardrail chips", async () => {
    const analysisPayload = {
      summary: "Parity metadata coverage.",
      uxCopywriting: { heading: "", summary: "", guidance: [], sources: [] },
      impact: {
        summary: "Impact metadata derivation.",
        areas: [
          {
            category: "Trust & Credibility",
            severity: "high",
            summary: [
              "Impact: High",
              "Effort: Low",
              "Refs: heuristics[1], WCAG 1.4.3",
              "OBS-1: Reassurance missing near CTA."
            ].join("\n")
          }
        ]
      },
      psychology: [
        {
          title: "Curiosity Gap",
          intent: "intentional",
          description: [
            "Intent: intentional",
            "Guardrail: Avoid manipulative gating.",
            "Signals:",
            "- Suspense-driven hero copy"
          ].join("\n")
        }
      ],
      heuristics: [],
      accessibility: [],
      recommendations: []
    };

    const container = renderApp();
    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: {
        selectionName: "Checkout Parity",
        exportedAt: "2025-10-18T15:45:00.000Z",
        analysis: analysisPayload
      }
    });

    await tick();

    const structured = normalizeAnalysis(analysisPayload);
    expect(structured.psychology[0]?.metadata).toEqual({
      intent: "Intentional",
      guardrail: ["Avoid manipulative gating."]
    });

    const impactTab = container.querySelector<HTMLButtonElement>("#analysis-tab-impact");
    expect(impactTab, "Impact tab should exist").not.toBeNull();
    await act(async () => {
      impactTab!.click();
    });
    await tick();

    const impactChips = Array.from(container.querySelectorAll('[data-impact-chip]')).map((node) => ({
      type: node.getAttribute("data-impact-chip"),
      text: node.textContent?.trim()
    }));
    expect(impactChips).toEqual([
      { type: "impact", text: "Impact High" },
      { type: "effort", text: "Effort Low" },
      { type: "refs", text: "Refs heuristics[1], WCAG 1.4.3" }
    ]);

    const impactParagraphs = Array.from(
      container.querySelectorAll("#analysis-panel-impact .impact-summary")
    ).map((node) => node.textContent?.trim());
    expect(
      impactParagraphs.some((text) => text?.startsWith("Impact:") || text?.startsWith("Effort:"))
    ).toBe(false);

    const psychologyTab = container.querySelector<HTMLButtonElement>("#analysis-tab-psychology");
    expect(psychologyTab, "Psychology tab should exist").not.toBeNull();
    await act(async () => {
      psychologyTab!.click();
    });
    await tick();

    const psychologyChips = Array.from(
      container.querySelectorAll('[data-psych-chip]')
    ).map((node) => ({
      type: node.getAttribute("data-psych-chip"),
      text: node.textContent?.trim()
    }));
    expect(psychologyChips).toEqual([
      { type: "intent", text: "Intent Intentional" },
      { type: "guardrail", text: "Guardrail Avoid manipulative gating." }
    ]);

    const psychologyParagraphs = Array.from(
      container.querySelectorAll("#analysis-panel-psychology .psychology-summary")
    ).map((node) => node.textContent?.trim());
    expect(
      psychologyParagraphs.some((text) => text?.startsWith("Intent:") || text?.startsWith("Guardrail:"))
    ).toBe(false);
  });
});
