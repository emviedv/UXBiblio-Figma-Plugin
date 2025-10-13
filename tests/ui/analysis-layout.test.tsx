import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cleanupApp,
  dispatchPluginMessage,
  dispatchRawPluginMessage,
  renderApp,
  tick
} from "./testHarness";

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

  it("does not surface palette swatches during analysis, even if legacy colors stream in", async () => {
    const container = renderApp();

    dispatchPluginMessage({
      type: "SELECTION_STATUS",
      payload: { hasSelection: true, selectionName: "Hero Frame" }
    });
    await tick();

    dispatchRawPluginMessage({
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
    expect(paletteGrid).toBeNull();
    const skeleton = container.querySelector(
      '.analysis-panel-section[data-active="true"] [data-skeleton="true"][role="status"]'
    );
    expect(skeleton).not.toBeNull();
  });

  it("shows an analyzing notice before rendering live cards", async () => {
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

    const analyzingNotice = container.querySelector(
      ".analysis-panel-section[data-active=\"true\"] .tab-empty-message"
    ) as HTMLParagraphElement | null;
    expect(analyzingNotice).not.toBeNull();
    expect(analyzingNotice?.textContent).toContain("Analyzing");
    expect(analyzingNotice?.textContent).toContain("Hero Frame");

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: {
        selectionName: "Hero Frame",
        exportedAt: new Date().toISOString(),
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
