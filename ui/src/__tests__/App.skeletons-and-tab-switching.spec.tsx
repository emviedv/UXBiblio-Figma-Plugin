import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import {
  cleanupApp,
  dispatchPluginMessage,
  renderApp,
  tick
} from "../../../tests/ui/testHarness";

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

    dispatchPluginMessage({ type: "ANALYSIS_IN_PROGRESS", payload: { selectionName: "Checkout Flow" } });
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
    expect(skeleton?.textContent).toContain("UX Summary");
  });

  it("does not revert selection when rapidly switching tabs during analyzing; the last clicked tab stays active and shows a skeleton", async () => {
    const container = renderApp();

    dispatchPluginMessage({ type: "SELECTION_STATUS", payload: { hasSelection: true, selectionName: "Profile Screen" } });
    await tick();

    dispatchPluginMessage({
      type: "ANALYSIS_IN_PROGRESS",
      payload: {
        selectionName: "Profile Screen"
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
    expect(psychologySkeleton?.textContent).toContain("Psychology");
  });
});
