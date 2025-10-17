import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import {
  cleanupApp,
  dispatchPluginMessage,
  renderApp,
  tick
} from "../../../tests/ui/testHarness";

function makeAnalysisPayload(selectionName: string) {
  return {
    selectionName,
    analysis: {
      summary: "High-level UX overview.",
      receipts: [{ title: "Nielsen 10 Heuristics", url: "https://www.nngroup.com/" }],
      heuristics: [{ title: "Visibility of system status" }],
      psychology: [{ title: "Social proof" }],
      impact: [{ title: "Conversion uplift" }],
      recommendations: ["Tighten the hero copy."]
    },
    metadata: {},
    exportedAt: new Date(0).toISOString()
  } as const;
}

describe("App: progress overlay appears immediately", () => {
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

  it("shows the skeleton overlay while keeping stale insights hidden during a second run", async () => {
    const container = renderApp();

    dispatchPluginMessage({
      type: "SELECTION_STATUS",
      payload: { hasSelection: true, selectionName: "Modal Frame" }
    });
    await tick();

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: makeAnalysisPayload("Modal Frame")
    });
    await tick();

    const summaryPanel = container.querySelector<HTMLElement>("#analysis-panel-ux-summary");
    expect(summaryPanel).not.toBeNull();
    const initialText = summaryPanel?.textContent ?? "";
    expect(initialText).toContain("High-level UX overview.");

    const analyzeButton = container.querySelector<HTMLButtonElement>(".search-section .primary-button");
    expect(analyzeButton).not.toBeNull();
    act(() => analyzeButton!.click());
    await tick();

    const stage = summaryPanel?.querySelector<HTMLElement>("[data-panel-stage]");
    expect(stage?.dataset.panelStage).toBe("analyzing");

    const skeleton = summaryPanel?.querySelector('[data-skeleton="true"][role="status"][aria-busy="true"]');
    expect(skeleton).not.toBeNull();
    const progress = skeleton?.querySelector(".global-progress");
    expect(progress).not.toBeNull();

    const contentContainer = summaryPanel?.querySelector<HTMLElement>("[data-panel-content-state]");
    expect(contentContainer?.dataset.panelContentState).toBe("stale");
    expect(contentContainer?.getAttribute("aria-hidden")).toBe("true");
    expect(contentContainer?.dataset.panelInert).toBe("true");

    const staleCopy = contentContainer?.textContent ?? "";
    expect(staleCopy).toContain("High-level UX overview.");
  });

  it("renders the progress skeleton immediately on the first run even with no cached content", async () => {
    const container = renderApp();

    dispatchPluginMessage({
      type: "SELECTION_STATUS",
      payload: { hasSelection: true, selectionName: "Hero Frame" }
    });
    await tick();

    const analyzeButton = container.querySelector<HTMLButtonElement>(".search-section .primary-button");
    expect(analyzeButton).not.toBeNull();
    act(() => analyzeButton!.click());
    await tick();

    const summaryPanel = container.querySelector<HTMLElement>("#analysis-panel-ux-summary");
    expect(summaryPanel).not.toBeNull();

    const stage = summaryPanel?.querySelector<HTMLElement>("[data-panel-stage]");
    expect(stage?.dataset.panelStage).toBe("analyzing");

    const skeleton = summaryPanel?.querySelector('[data-skeleton="true"][role="status"][aria-busy="true"]');
    expect(skeleton).not.toBeNull();
    const progress = skeleton?.querySelector(".global-progress");
    expect(progress).not.toBeNull();

    const contentContainer = summaryPanel?.querySelector<HTMLElement>("[data-panel-content-state]");
    expect(contentContainer?.dataset.panelContentState).toBe("void");
    expect(contentContainer?.getAttribute("aria-hidden")).toBe("true");
    expect(contentContainer?.dataset.panelInert).toBe("true");
    expect((contentContainer?.textContent ?? "").trim()).toBe("");
  });
});
