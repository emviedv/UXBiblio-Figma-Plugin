import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanupApp, dispatchPluginMessage, renderApp, tick } from "./testHarness";

const HISTORY_KEY = "uxbiblio.analysisDurationsMs";

function makeResultPayload(selectionName: string) {
  return {
    selectionName,
    exportedAt: new Date().toISOString(),
    analysis: {
      heuristics: [],
      accessibility: [],
      psychology: [],
      impact: [],
      recommendations: []
    }
  } as const;
}

describe("App analysis duration history", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
    window.localStorage.removeItem(HISTORY_KEY);
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanupApp();
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.localStorage.removeItem(HISTORY_KEY);
  });

  it("records elapsed time for successful analyses", async () => {
    renderApp();

    dispatchPluginMessage({
      type: "SELECTION_STATUS",
      payload: { hasSelection: true, selectionName: "Modal Frame" }
    });
    await tick();

    dispatchPluginMessage({
      type: "ANALYSIS_IN_PROGRESS",
      payload: { selectionName: "Modal Frame" }
    });
    await tick();

    await act(async () => {
      vi.advanceTimersByTime(45_000);
      await Promise.resolve();
    });

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: makeResultPayload("Modal Frame")
    });
    await tick();

    const persisted = window.localStorage.getItem(HISTORY_KEY);
    expect(persisted).not.toBeNull();

    const parsed = persisted ? JSON.parse(persisted) : [];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.at(-1)).toBeGreaterThanOrEqual(45_000);
  });

  it("omits short error runs from the analysis history", async () => {
    renderApp();

    dispatchPluginMessage({
      type: "SELECTION_STATUS",
      payload: { hasSelection: true, selectionName: "Hero Section" }
    });
    await tick();

    dispatchPluginMessage({
      type: "ANALYSIS_IN_PROGRESS",
      payload: { selectionName: "Hero Section" }
    });
    await tick();

    await act(async () => {
      vi.advanceTimersByTime(3_000);
      await Promise.resolve();
    });

    dispatchPluginMessage({
      type: "ANALYSIS_ERROR",
      error: "Analysis timed out."
    });
    await tick();

    expect(window.localStorage.getItem(HISTORY_KEY)).toBeNull();
  });
});
