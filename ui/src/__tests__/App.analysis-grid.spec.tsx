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
      payload: { selectionName: "Example", colors: [] }
    });

    await waitFor(() => {
      expect(container.querySelector(".analysis-grid")).not.toBeNull();
    });
  });

  it("shows awaiting tab status when analysis data is absent", async () => {
    const { container } = render(<App />);

    dispatchPluginMessage({ type: "SELECTION_STATUS", payload: { hasSelection: true } });
    dispatchPluginMessage({
      type: "ANALYSIS_IN_PROGRESS",
      payload: {
        selectionName: "Awaiting",
        colors: [{ hex: "#d75695" }]
      }
    });

    await waitFor(() => {
      const paletteSwatch = container.querySelector(
        ".analysis-panel-section[data-active=\"true\"] .palette-grid .swatch"
      );
      expect(paletteSwatch).not.toBeNull();
    });
  });

  it("updates analysis tabs once results arrive", async () => {
    const { container } = render(<App />);

    dispatchPluginMessage({ type: "SELECTION_STATUS", payload: { hasSelection: true } });
    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: {
        selectionName: "Example",
        colors: [],
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
});
