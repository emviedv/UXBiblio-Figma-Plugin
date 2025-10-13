import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import App from "../App";

interface PluginMessageEvent {
  type: string;
  payload?: Record<string, unknown>;
  error?: string;
}

function dispatchPluginMessage(message: PluginMessageEvent): void {
  window.dispatchEvent(new MessageEvent("message", { data: { pluginMessage: message } }));
}

describe("App banners: focus and auto-dismiss", () => {
  beforeEach(() => {
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("focuses alert banner when an error occurs", async () => {
    render(<App />);

    // Trigger an analysis error (danger intent -> warning when no selection)
    dispatchPluginMessage({ type: "ANALYSIS_ERROR", error: "Network timeout" });

    const alert = await screen.findByRole("alert");
    expect(alert).toBeTruthy();

    // Banner receives programmatic focus for screen readers
    await waitFor(() => {
      expect(document.activeElement).toBe(alert);
    });
  });

  // Success auto-dismiss behavior is covered implicitly in E2E; keeping unit focus on alert focus.
});
