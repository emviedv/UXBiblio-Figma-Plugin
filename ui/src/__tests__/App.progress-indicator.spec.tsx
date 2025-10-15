import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanupApp,
  dispatchPluginMessage,
  renderApp,
  tick
} from "../../../tests/ui/testHarness";

const HISTORY_KEY = "uxbiblio.analysisDurationsMs";
const LEGACY_KEY = "uxbiblio.analysisDurations";

function makeAnalysisPayload(selectionName: string) {
  return {
    selectionName,
    analysis: {
      summary: "High-level overview.",
      receipts: [{ title: "Heuristic source", url: "https://example.com" }],
      heuristics: [{ title: "Visibility of system status", description: "Provide timely feedback." }],
      psychology: [{ title: "Social proof", description: "Use testimonials." }],
      impact: [{ title: "Conversion", description: "Potential uplift." }],
      recommendations: ["Tighten the hero copy."]
    },
    metadata: {},
    exportedAt: new Date(0).toISOString()
  } as const;
}

describe("App: global progress indicator", () => {
  beforeEach(() => {
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
    window.localStorage.removeItem(HISTORY_KEY);
    window.localStorage.removeItem(LEGACY_KEY);
  });

  afterEach(() => {
    window.localStorage.removeItem(HISTORY_KEY);
    window.localStorage.removeItem(LEGACY_KEY);
    cleanupApp();
    vi.restoreAllMocks();
  });

  it("renders an ETA callout when analysis history exists", async () => {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify([32000, 36000, 41000]));

    const container = renderApp();

    dispatchPluginMessage({
      type: "SELECTION_STATUS",
      payload: { hasSelection: true, selectionName: "Flow" }
    });
    await tick();

    dispatchPluginMessage({
      type: "ANALYSIS_IN_PROGRESS",
      payload: { selectionName: "Flow" }
    });
    await tick();

    const callout = container.querySelector(".global-progress-callout");
    expect(callout).not.toBeNull();
    expect(callout?.textContent ?? "").toMatch(/ETA:\s+(About \d+ minutes? remaining|Wrapping up…)/);
  });

  it("migrates legacy seconds-based history and surfaces the ETA callout", async () => {
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify([42, 47, 39]));

    const container = renderApp();

    dispatchPluginMessage({
      type: "SELECTION_STATUS",
      payload: { hasSelection: true, selectionName: "Legacy Flow" }
    });
    await tick();

    dispatchPluginMessage({
      type: "ANALYSIS_IN_PROGRESS",
      payload: { selectionName: "Legacy Flow" }
    });
    await tick();
    await tick();

    const callout = container.querySelector(".global-progress-callout");
    expect(callout).not.toBeNull();
    expect(callout?.textContent ?? "").toContain("ETA:");

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: makeAnalysisPayload("Legacy Flow")
    });
    await tick();

    const migrated = window.localStorage.getItem(HISTORY_KEY);
    expect(migrated).not.toBeNull();

    const parsed = migrated ? JSON.parse(migrated) : [];
    expect(Array.isArray(parsed)).toBe(true);
    if (Array.isArray(parsed)) {
      expect(parsed.length).toBeGreaterThanOrEqual(3);
      expect(parsed.slice(0, 3).every((value) => typeof value === "number" && value > 1000)).toBe(true);
    }
  });
});
