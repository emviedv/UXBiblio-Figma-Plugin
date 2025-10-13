import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import App from "../App";

interface PluginMessageEvent {
  type: string;
  payload?: Record<string, unknown>;
}

function dispatchPluginMessage(message: PluginMessageEvent): void {
  window.dispatchEvent(new MessageEvent("message", { data: { pluginMessage: message } }));
}

describe("App analysis layout", () => {
  beforeEach(() => {
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps analysis grid scaffold during analyzing state", async () => {
    const { container } = render(<App />);

    dispatchPluginMessage({ type: "SELECTION_STATUS", payload: { hasSelection: true } });
    dispatchPluginMessage({
      type: "ANALYSIS_IN_PROGRESS",
      payload: { selectionName: "Example" }
    });

    await waitFor(() => {
      expect(container.querySelector(".analysis-grid")).not.toBeNull();
    });
  });

  it("shows initial empty state when no selection is active", () => {
    const { container } = render(<App />);

    const emptyTitle = container.querySelector(".tab-empty-title");
    expect(emptyTitle?.textContent?.trim()).toBe("No frame selected");
    const emptyMessage = container.querySelector(".tab-empty-message");
    expect(emptyMessage?.textContent?.trim()).toBe(
      "Choose a Frame, then click Analyze Selection to generate UX, accessibility, and psychology insights in seconds."
    );
  });

  it("shows initial empty state when selection is ready but analysis has not started", async () => {
    const { container } = render(<App />);

    dispatchPluginMessage({
      type: "SELECTION_STATUS",
      payload: { hasSelection: true, selectionName: "Marketing Frame" }
    });

    await waitFor(() => {
      const emptyTitle = container.querySelector(
        '.analysis-panel-section[data-active="true"] .tab-empty-title'
      );
      expect(emptyTitle?.textContent?.trim()).toBe("No frame selected");
      const emptyMessage = container.querySelector(
        '.analysis-panel-section[data-active="true"] .tab-empty-message'
      );
      expect(emptyMessage?.textContent?.trim()).toBe(
        "Choose a Frame, then click Analyze Selection to generate UX, accessibility, and psychology insights in seconds."
      );
    });
  });

  it("shows awaiting tab status when analysis data is absent", async () => {
    const { container } = render(<App />);

    dispatchPluginMessage({ type: "SELECTION_STATUS", payload: { hasSelection: true } });
    dispatchPluginMessage({
      type: "ANALYSIS_IN_PROGRESS",
      payload: {
        selectionName: "Awaiting"
      }
    });

    await waitFor(() => {
      const activePanel = container.querySelector(".analysis-panel-section[data-active=\"true\"]");
      expect(activePanel).not.toBeNull();
      const skeleton = activePanel?.querySelector('[data-skeleton="true"]');
      expect(skeleton).not.toBeNull();
      const paletteNodes = activePanel?.querySelector(".palette-grid, .palette-swatch, .summary-palette");
      expect(paletteNodes).toBeNull();
    });
  });

  it("updates analysis tabs once results arrive", async () => {
    const { container } = render(<App />);

    dispatchPluginMessage({ type: "SELECTION_STATUS", payload: { hasSelection: true } });
    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: {
        selectionName: "Example",
        analysis: {
          analysis: {
            heuristics: [{ title: "Touch target guidance" }],
            recommendations: ["Improve tap area"]
          }
        }
      }
    });

    await waitFor(() => {
      const tabs = container.querySelectorAll(".analysis-tab");
      expect(tabs.length).toBeGreaterThan(0);
    });
  });

  it("keeps previous tab content accessible while analyzing", async () => {
    const { container } = render(<App />);

    dispatchPluginMessage({ type: "SELECTION_STATUS", payload: { hasSelection: true } });
    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: {
        selectionName: "Example",
        analysis: {
          analysis: {
            heuristics: [{ title: "Touch target guidance", description: "Ensure 44px targets." }]
          }
        }
      }
    });

    await waitFor(() => {
      const heuristicsTab = container.querySelector("#analysis-tab-heuristics");
      expect(heuristicsTab).not.toBeNull();
    });

    dispatchPluginMessage({
      type: "ANALYSIS_IN_PROGRESS",
      payload: {
        selectionName: "Example"
      }
    });

    const heuristicsTab = container.querySelector<HTMLButtonElement>("#analysis-tab-heuristics");
    expect(heuristicsTab).not.toBeNull();
    heuristicsTab!.click();

    await waitFor(() => {
      const heuristicsPanel = container.querySelector("#analysis-panel-heuristics");
      expect(heuristicsPanel).not.toBeNull();
      if (!heuristicsPanel) {
        throw new Error("Expected heuristics panel to be present");
      }
      expect(heuristicsPanel.hasAttribute("hidden")).toBe(false);
      const heuristicsDescription = heuristicsPanel.querySelector(".card-item-description");
      expect(heuristicsDescription?.textContent).toContain("Ensure 44px targets.");
    });
  });
});
