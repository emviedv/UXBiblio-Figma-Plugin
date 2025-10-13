import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { cleanupApp, dispatchPluginMessage, renderApp, tick } from "../../../tests/ui/testHarness";

describe("App: tab switching during analysis shows skeletons", () => {
  beforeEach(() => {
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
    cleanupApp();
  });

  afterEach(() => {
    cleanupApp();
    vi.restoreAllMocks();
  });

  it("allows switching to an incomplete tab during analyzing and shows a skeleton state", async () => {
    const container = renderApp();

    // Selection present, analysis started (no partial content yet)
    dispatchPluginMessage({ type: "SELECTION_STATUS", payload: { hasSelection: true, selectionName: "Checkout Flow" } });
    await tick();

    dispatchPluginMessage({ type: "ANALYSIS_IN_PROGRESS", payload: { selectionName: "Checkout Flow", colors: [] } });
    await tick();

    // Click a tab that currently has no content (e.g., UX Summary)
    const uxSummaryTab = container.querySelector<HTMLButtonElement>("#analysis-tab-ux-summary");
    expect(uxSummaryTab).not.toBeNull();
    act(() => uxSummaryTab!.click());
    await tick();

    const uxSummaryPanel = container.querySelector("#analysis-panel-ux-summary");
    expect(uxSummaryPanel).not.toBeNull();
    // Panel should be active (visible)
    expect(uxSummaryPanel?.hasAttribute("hidden")).toBe(false);

    // In analyzing state with no content, the panel should render a skeleton placeholder
    const skeleton = uxSummaryPanel?.querySelector('[data-skeleton="true"][role="status"][aria-busy="true"]');
    expect(skeleton).not.toBeNull();
  });

  it("when colors stream in during analysis, Color Palette remains hidden and other tabs show skeletons without auto-bouncing", async () => {
    const container = renderApp();

    dispatchPluginMessage({ type: "SELECTION_STATUS", payload: { hasSelection: true, selectionName: "Marketing Frame" } });
    await tick();

    // During analysis we have partial color palette data
    dispatchPluginMessage({
      type: "ANALYSIS_IN_PROGRESS",
      payload: {
        selectionName: "Marketing Frame",
        colors: [{ hex: "#D75695" }]
      }
    });
    await tick();

    // The Color Palette tab should no longer be exposed in the sidebar
    const paletteTab = container.querySelector("#analysis-tab-color-palette");
    expect(paletteTab).toBeNull();

    // The default tab (UX Summary) remains active and shows a skeleton while analyzing
    const summaryTab = container.querySelector<HTMLButtonElement>("#analysis-tab-ux-summary");
    expect(summaryTab?.getAttribute("aria-selected")).toBe("true");
    const summaryPanel = container.querySelector("#analysis-panel-ux-summary");
    expect(summaryPanel?.querySelector('[data-skeleton="true"]')).not.toBeNull();

    // Switching to other tabs still works and shows skeletons without bouncing
    const heuristicsTab = container.querySelector<HTMLButtonElement>("#analysis-tab-heuristics");
    expect(heuristicsTab).not.toBeNull();
    act(() => heuristicsTab!.click());
    await tick();

    // It should remain selected (no auto-bounce back to palette)
    expect(heuristicsTab?.getAttribute("aria-selected")).toBe("true");

    const heuristicsPanel = container.querySelector("#analysis-panel-heuristics");
    expect(heuristicsPanel).not.toBeNull();
    expect(heuristicsPanel?.hasAttribute("hidden")).toBe(false);
    const heuristicsSkeleton = heuristicsPanel?.querySelector('[data-skeleton="true"]');
    expect(heuristicsSkeleton).not.toBeNull();
  });

  it("does not revert selection when rapidly switching tabs during analyzing; the last clicked tab stays active and shows a skeleton", async () => {
    const container = renderApp();

    dispatchPluginMessage({ type: "SELECTION_STATUS", payload: { hasSelection: true, selectionName: "Profile Screen" } });
    await tick();

    dispatchPluginMessage({
      type: "ANALYSIS_IN_PROGRESS",
      payload: {
        selectionName: "Profile Screen",
        colors: [{ hex: "#d75695" }]
      }
    });
    await tick();

    const uxCopyTab = container.querySelector<HTMLButtonElement>("#analysis-tab-ux-copywriting, #analysis-tab-ux-copy");
    const psychologyTab = container.querySelector<HTMLButtonElement>("#analysis-tab-psychology");
    const summaryTab = container.querySelector<HTMLButtonElement>("#analysis-tab-ux-summary");

    // Some builds may label the copy tab id as ux-copywriting or ux-copy; click whichever exists
    const copyTab = uxCopyTab ?? container.querySelector<HTMLButtonElement>("#analysis-tab-ux-copywriting");

    expect(summaryTab).not.toBeNull();
    expect(psychologyTab).not.toBeNull();

    if (copyTab) {
      act(() => copyTab.click());
      await tick();
    }
    act(() => summaryTab!.click());
    await tick();
    act(() => psychologyTab!.click());
    await tick();

    // The last clicked (psychology) should be the active one
    expect(psychologyTab?.getAttribute("aria-selected")).toBe("true");
    const psychologyPanel = container.querySelector("#analysis-panel-psychology");
    expect(psychologyPanel).not.toBeNull();
    expect(psychologyPanel?.hasAttribute("hidden")).toBe(false);
    const psychologySkeleton = psychologyPanel?.querySelector('[data-skeleton="true"]');
    expect(psychologySkeleton).not.toBeNull();
  });
});
