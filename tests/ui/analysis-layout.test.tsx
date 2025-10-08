import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupApp, dispatchPluginMessage, renderApp, tick } from "./testHarness";

describe("Analysis layout stability", () => {
  beforeEach(() => {
    cleanupApp();
  });

  afterEach(() => {
    cleanupApp();
  });

  it("marks the analysis panel as layout-stable during loading and after results", async () => {
    const container = renderApp();

    dispatchPluginMessage({
      type: "SELECTION_STATUS",
      payload: {
        hasSelection: true,
        selectionName: "Hero Frame"
      }
    });
    await tick();

    dispatchPluginMessage({
      type: "ANALYSIS_IN_PROGRESS",
      payload: { selectionName: "Hero Frame" }
    });
    await tick();

    const panelDuring = container.querySelector(".analysis-panel") as HTMLDivElement | null;
    expect(panelDuring).not.toBeNull();
    expect(panelDuring?.getAttribute("data-layout-stable")).toBe("true");

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: {
        selectionName: "Hero Frame",
        exportedAt: new Date().toISOString(),
        colors: [{ hex: "#d75695" }],
        analysis: {
          heuristics: [{ title: "Spacing", description: "Tight padding" }],
          accessibility: [],
          psychology: [],
          impact: [],
          recommendations: []
        }
      }
    });
    await tick();

    const panelAfter = container.querySelector(".analysis-panel") as HTMLDivElement | null;
    expect(panelAfter).not.toBeNull();
    expect(panelAfter?.getAttribute("data-layout-stable")).toBe("true");
  });

  it("shows palette swatches during analysis when colors are present", async () => {
    const container = renderApp();

    dispatchPluginMessage({
      type: "SELECTION_STATUS",
      payload: { hasSelection: true, selectionName: "Hero Frame" }
    });
    await tick();

    dispatchPluginMessage({
      type: "ANALYSIS_IN_PROGRESS",
      payload: {
        selectionName: "Hero Frame",
        colors: [
          { hex: "#d75695" },
          { hex: "#f986ad" }
        ]
      }
    });
    await tick();

    const paletteGrid = container.querySelector(".analysis-panel-section[data-active=\"true\"] .palette-grid");
    expect(paletteGrid).not.toBeNull();
    const swatches = paletteGrid?.querySelectorAll(".swatch");
    expect(swatches && swatches.length).toBeGreaterThan(0);
  });

  it("annotates skeleton cards as square surfaces that match live cards", async () => {
    const container = renderApp();

    dispatchPluginMessage({
      type: "SELECTION_STATUS",
      payload: {
        hasSelection: true,
        selectionName: "Hero Frame"
      }
    });
    await tick();

    dispatchPluginMessage({
      type: "ANALYSIS_IN_PROGRESS",
      payload: { selectionName: "Hero Frame" }
    });
    await tick();

    const skeletonCard = container.querySelector(
      ".analysis-skeleton section[data-card-surface=\"true\"]"
    );
    expect(skeletonCard).toBeTruthy();
    expect(skeletonCard?.getAttribute("data-skeleton-shape")).toBe("square");

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: {
        selectionName: "Hero Frame",
        exportedAt: new Date().toISOString(),
        colors: [{ hex: "#d75695" }],
        analysis: {
          heuristics: [{ title: "Spacing", description: "Tight padding" }],
          accessibility: [],
          psychology: [],
          impact: [],
          recommendations: []
        }
      }
    });
    await tick();

    const liveCard = container.querySelector(
      ".analysis-panel-section[data-active=\"true\"] section[data-card-surface=\"true\"]"
    );
    expect(liveCard).toBeTruthy();
  });
});
