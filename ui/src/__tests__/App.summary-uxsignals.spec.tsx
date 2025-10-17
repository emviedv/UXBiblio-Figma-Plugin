import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanupApp,
  dispatchPluginMessage,
  renderApp,
  tick
} from "../../../tests/ui/testHarness";

let originalConsoleError: typeof console.error;

describe("App UX Summary uxSignals", () => {
  beforeEach(() => {
    originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      originalConsoleError?.(...args);
      throw new Error(
        `Unexpected console.error in App.summary-uxsignals.spec.tsx: ${args
          .map((value) => String(value))
          .join(" ")}`
      );
    };
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
  });

  afterEach(() => {
    console.error = originalConsoleError;
    cleanupApp();
    vi.restoreAllMocks();
  });

  it("renders uxSignals in the summary tab and omits the color palette section", async () => {
    const container = renderApp();

    dispatchPluginMessage({
      type: "SELECTION_STATUS",
      payload: { hasSelection: true, selectionName: "Marketing Hero" }
    });
    await tick();

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: {
        selectionName: "Marketing Hero",
        exportedAt: "2025-10-27T09:15:00.000Z",
        analysis: {
          scopeNote: "OBS-1 identifies the hero headline. OBS-2 captures the CTA placement.",
          summary:
            "OBS-3 explains the supporting copy call-to-action alignment. OBS-4 references user expectation.",
          receipts: [],
          uxSignals: ["Conversion friction", "Opportunity: highlight reassurance"],
          heuristics: [],
          accessibility: [],
          psychology: [],
          impact: [],
          recommendations: []
        }
      }
    });
    await tick();

    const summaryRegion = container.querySelector('[data-ux-tab="summary"]');
    expect(summaryRegion).not.toBeNull();

    const signalsSection = summaryRegion?.querySelector('[data-ux-section="summary-signals"]');
    expect(signalsSection).not.toBeNull();

    const renderedSignals = Array.from(
      signalsSection?.querySelectorAll("li") ?? []
    ).map((node) => node.textContent?.trim());
    expect(renderedSignals).toEqual([
      "Conversion friction",
      "Opportunity: highlight reassurance"
    ]);

    const inlinePalette = summaryRegion?.querySelector('[data-inline-palette="true"]');
    expect(inlinePalette).toBeNull();
  });
});
