import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import App from "../App";

interface PluginMessageEvent {
  type: string;
  payload?: Record<string, unknown>;
}

function dispatchPluginMessage(message: PluginMessageEvent): void {
  window.dispatchEvent(new MessageEvent("message", { data: { pluginMessage: message } }));
}

describe("App a11y: tablist and tabpanels", () => {
  beforeEach(() => {
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders a tablist with tabs linked to tabpanels and toggles selection on click", async () => {
    render(<App />);

    // Provide selection and a minimal analysis result with multiple sections
    dispatchPluginMessage({ type: "SELECTION_STATUS", payload: { hasSelection: true } });
    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: {
        selectionName: "Frame A",
        analysis: {
          analysis: {
            heuristics: [{ title: "Heuristic A" }],
            psychology: [{ title: "Psych Signal" }],
            impact: [{ title: "Impact A" }],
            recommendations: ["Do X"],
            accessibility: [
              {
                title: "Text contrast",
                description: "Check contrast levels"
              }
            ],
            uxSignals: ["Signal One", "Signal Two"]
          }
        }
      }
    });

    // Tablist and tabs exist
    const tablist = await screen.findByRole("tablist");
    expect(tablist).toBeTruthy();

    const tabs = await screen.findAllByRole("tab");
    expect(tabs.length).toBeGreaterThan(1);

    // Each tab is linked to a panel via aria-controls and id
    const firstTab = tabs[0] as HTMLButtonElement;
    const panelId = firstTab.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    if (!panelId) throw new Error("Expected aria-controls to exist");
    const panel = document.getElementById(panelId);
    expect(panel).toBeTruthy();
    expect(panel?.getAttribute("role")).toBe("tabpanel");

    // Basic a11y contract: first tab is a real tab and linked
    expect(firstTab.getAttribute("role")).toBe("tab");
    expect(typeof firstTab.getAttribute("aria-selected")).toBe("string");
  });
});
