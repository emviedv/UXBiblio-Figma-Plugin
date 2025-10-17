import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import {
  cleanupApp,
  dispatchPluginMessage,
  renderApp,
  tick
} from "../../../tests/ui/testHarness";

function makeAnalysisPayload(selectionName: string, options?: { uxSignals?: string[] }) {
  // Minimal but valid payload that produces content for multiple tabs
  return {
    selectionName,
    analysis: {
      summary: "High-level UX overview.",
      receipts: [{ title: "Nielsen 10 Heuristics", url: "https://nngroup.com" }],
      heuristics: [{ title: "Visibility of system status", description: "Show feedback promptly." }],
      psychology: [{ title: "Social proof", description: "Use testimonials." }],
      impact: [{ title: "Conversion", description: "Potential uplift" }],
      recommendations: ["Tighten copy above the fold."],
      uxSignals: options?.uxSignals ?? ["Trust opportunity"]
    },
    metadata: {},
    exportedAt: new Date(0).toISOString()
  } as const;
}

describe("App: repeated analyses reset tabs to skeleton", () => {
  beforeEach(() => {
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
    cleanupApp();
  });

  afterEach(() => {
    cleanupApp();
    vi.restoreAllMocks();
  });

  it("after a completed run, clicking Analyze again shows a skeleton in the active tab until new results arrive", async () => {
    const container = renderApp();

    // 1) User has a selection
    dispatchPluginMessage({ type: "SELECTION_STATUS", payload: { hasSelection: true, selectionName: "First Run" } });
    await tick();

    // 2) First run completes with psychology content
    dispatchPluginMessage({ type: "ANALYSIS_RESULT", payload: makeAnalysisPayload("First Run") });
    await tick();

    // 3) Switch to a tab that has content (Psychology)
    const psychologyTab = container.querySelector<HTMLButtonElement>("#analysis-tab-psychology");
    expect(psychologyTab).not.toBeNull();
    act(() => psychologyTab!.click());
    await tick();

    const psychologyPanel = container.querySelector("#analysis-panel-psychology");
    expect(psychologyPanel).not.toBeNull();
    expect(psychologyPanel?.hasAttribute("hidden")).toBe(false);

    // Sanity: it currently renders real content (no skeleton) post-success
    const preSecondRunSkeleton = psychologyPanel?.querySelector('[data-skeleton="true"]');
    expect(preSecondRunSkeleton).toBeNull();

    // 4) User initiates a second run by clicking Analyze
    const analyzeButton = container.querySelector<HTMLButtonElement>(".search-section .primary-button");
    expect(analyzeButton).not.toBeNull();
    act(() => analyzeButton!.click());
    await tick();

    // EXPECTED (correct behavior): while analyzing, the active tab should show a skeleton
    const skeleton = psychologyPanel?.querySelector('[data-skeleton="true"][role="status"][aria-busy="true"]');
    expect(skeleton).not.toBeNull();
  });

  it("second run updates summary uxSignals when new results arrive", async () => {
    const container = renderApp();

    dispatchPluginMessage({
      type: "SELECTION_STATUS",
      payload: { hasSelection: true, selectionName: "Frame A" }
    });
    await tick();

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: makeAnalysisPayload("Frame A", { uxSignals: ["Signal Alpha"] })
    });
    await tick();

    const collectSignals = () =>
      Array.from(
        container.querySelectorAll('[data-ux-tab="summary"] [data-ux-section="summary-signals"] li')
      ).map((node) => node.textContent?.trim());

    expect(collectSignals()).toEqual(["Signal Alpha"]);

    const analyzeButton = container.querySelector<HTMLButtonElement>(".search-section .primary-button");
    expect(analyzeButton).not.toBeNull();
    act(() => analyzeButton!.click());
    await tick();

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: makeAnalysisPayload("Frame A — Iteration", {
        uxSignals: ["Signal Beta", "Signal Gamma"]
      })
    });
    await tick();

    expect(collectSignals()).toEqual(["Signal Beta", "Signal Gamma"]);
  });

  it("third run keeps skeletons active across tabs until new results arrive", async () => {
    const container = renderApp();

    // Prime with an initial completed run (content available across tabs)
    dispatchPluginMessage({ type: "SELECTION_STATUS", payload: { hasSelection: true, selectionName: "Card Catalog" } });
    await tick();
    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: {
        selectionName: "Card Catalog",
        analysis: {
          summary: "Cards rendered.",
          heuristics: [{ title: "Consistency" }],
          psychology: [{ title: "Anchoring" }],
          impact: [{ title: "Engagement" }],
          recommendations: ["Improve hierarchy"],
          uxSignals: ["Signal Delta"]
        },
        metadata: {},
        exportedAt: new Date(0).toISOString()
      }
    });
    await tick();

    // Start a second run and immediately finish it to simulate rapid iteration
    const analyzeBtn = container.querySelector<HTMLButtonElement>(".search-section .primary-button");
    expect(analyzeBtn).not.toBeNull();
    act(() => analyzeBtn!.click());
    await tick();
    dispatchPluginMessage({ type: "ANALYSIS_RESULT", payload: makeAnalysisPayload("Card Catalog v2") });
    await tick();

    // Begin a third run; explicitly send in-progress update — all tabs should show skeletons
    const analyzeBtn2 = container.querySelector<HTMLButtonElement>(".search-section .primary-button");
    expect(analyzeBtn2).not.toBeNull();
    act(() => analyzeBtn2!.click());
    await tick();
    dispatchPluginMessage({ type: "ANALYSIS_IN_PROGRESS", payload: { selectionName: "Card Catalog v3" } });
    await tick();

    // Switch to Heuristics and Psychology; both should show skeletons
    const heuristicsTab = container.querySelector<HTMLButtonElement>("#analysis-tab-heuristics");
    const psychologyTab = container.querySelector<HTMLButtonElement>("#analysis-tab-psychology");
    expect(heuristicsTab).not.toBeNull();
    expect(psychologyTab).not.toBeNull();
    act(() => heuristicsTab!.click());
    await tick();
    const heuristicsPanel = container.querySelector("#analysis-panel-heuristics");
    expect(heuristicsPanel?.hasAttribute("hidden")).toBe(false);
    const heuristicsSkeleton = heuristicsPanel?.querySelector('[data-skeleton="true"][role="status"][aria-busy="true"]');
    expect(heuristicsSkeleton).not.toBeNull();
    act(() => psychologyTab!.click());
    await tick();
    const psychologyPanel = container.querySelector("#analysis-panel-psychology");
    expect(psychologyPanel?.hasAttribute("hidden")).toBe(false);
    const psychologySkeleton = psychologyPanel?.querySelector('[data-skeleton="true"][role="status"][aria-busy="true"]');
    expect(psychologySkeleton).not.toBeNull();
  });

  it("a11y: main content sets aria-busy during analyzing", async () => {
    const container = renderApp();
    dispatchPluginMessage({ type: "SELECTION_STATUS", payload: { hasSelection: true, selectionName: "Article" } });
    await tick();

    const main = container.querySelector("main.content");
    expect(main).not.toBeNull();
    // Not analyzing yet
    expect(main?.getAttribute("aria-busy")).toBe(null);

    // Begin analyzing
    const analyzeBtn = container.querySelector<HTMLButtonElement>(".search-section .primary-button");
    expect(analyzeBtn).not.toBeNull();
    act(() => analyzeBtn!.click());
    await tick();

    // Now aria-busy should be "true"
    expect(main?.getAttribute("aria-busy")).toBe("true");
  });
});
