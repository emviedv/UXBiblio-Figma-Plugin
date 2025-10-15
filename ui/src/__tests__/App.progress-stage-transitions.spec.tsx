import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import {
  cleanupApp,
  dispatchPluginMessage,
  renderApp,
  tick
} from "../../../tests/ui/testHarness";

function makeAnalysisPayload(selectionName: string, summary: string) {
  return {
    selectionName,
    analysis: {
      summary,
      receipts: [{ title: "NNG", url: "https://nngroup.com" }],
      heuristics: [{ title: "Match between system and real world" }]
    },
    metadata: {},
    exportedAt: new Date(0).toISOString()
  } as const;
}

describe("App: progress stage transitions", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
    cleanupApp();
  });

  afterEach(() => {
    cleanupApp();
    vi.restoreAllMocks();
    if (consoleErrorSpy.mock.calls.length > 0) {
      throw new Error(
        `Unexpected console.error calls: ${consoleErrorSpy.mock.calls.map((call) => call.join(" ")).join("\n")}`
      );
    }
  });

  it("resets aria-hidden state after analysis completes and updates cached content", async () => {
    const container = renderApp();

    dispatchPluginMessage({
      type: "SELECTION_STATUS",
      payload: { hasSelection: true, selectionName: "Landing Page" }
    });
    await tick();

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: makeAnalysisPayload("Landing Page", "First summary.")
    });
    await tick();

    const summaryPanel = container.querySelector<HTMLElement>("#analysis-panel-ux-summary");
    expect(summaryPanel).not.toBeNull();

    const stage = summaryPanel?.querySelector<HTMLElement>("[data-panel-stage]");
    expect(stage?.dataset.panelStage).toBe("success");

    const contentContainer = summaryPanel?.querySelector<HTMLElement>("[data-panel-content-state]");
    expect(contentContainer?.dataset.panelContentState).toBe("active");
    expect(contentContainer?.getAttribute("aria-hidden")).toBeNull();
    expect(contentContainer?.dataset.panelInert ?? "false").toBe("false");
    expect(contentContainer?.textContent ?? "").toContain("First summary.");

    const analyzeButton = container.querySelector<HTMLButtonElement>(".search-section .primary-button");
    expect(analyzeButton).not.toBeNull();
    act(() => analyzeButton!.click());
    await tick();

    expect(stage?.dataset.panelStage).toBe("analyzing");
    expect(contentContainer?.getAttribute("aria-hidden")).toBe("true");
    expect(contentContainer?.dataset.panelContentState).toBe("stale");
    expect(contentContainer?.dataset.panelInert).toBe("true");

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: makeAnalysisPayload("Landing Page", "Updated summary.")
    });
    await tick();

    expect(stage?.dataset.panelStage).toBe("success");
    expect(contentContainer?.dataset.panelContentState).toBe("active");
    expect(contentContainer?.getAttribute("aria-hidden")).toBeNull();
    expect(contentContainer?.dataset.panelInert ?? "false").toBe("false");
    expect(contentContainer?.textContent ?? "").toContain("Updated summary.");
  });
});
