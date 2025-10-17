import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cleanupApp,
  dispatchPluginMessage,
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

  it("renders uxSignals inside the summary tab when analysis completes", async () => {
    const container = renderApp();

    dispatchPluginMessage({
      type: "SELECTION_STATUS",
      payload: { hasSelection: true, selectionName: "Hero Frame" }
    });
    await tick();

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: {
        selectionName: "Hero Frame",
        exportedAt: new Date().toISOString(),
        analysis: {
          scopeNote: "OBS-1: headline contrast. OBS-2: CTA placement.",
          summary: "OBS-3 references trust badges. OBS-4 maps the up-sell flow.",
          uxSignals: ["Trust cue missing", "Opportunity: highlight reassurance"],
          receipts: [],
          heuristics: [],
          accessibility: [],
          psychology: [],
          impact: [],
          recommendations: []
        }
      }
    });
    await tick();

    const summaryRegion = container.querySelector('[data-ux-tab="summary"]');
    expect(summaryRegion).not.toBeNull();
    const signalsList = summaryRegion?.querySelector('[data-ux-section="summary-signals"]');
    expect(signalsList).not.toBeNull();
    const signals = Array.from(signalsList?.querySelectorAll("li") ?? []).map((node) =>
      node.textContent?.trim()
    );
    expect(signals).toEqual(["Trust cue missing", "Opportunity: highlight reassurance"]);
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
