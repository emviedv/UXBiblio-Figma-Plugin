import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import App from "../App";

interface PluginMessageEvent {
  type: string;
  payload?: Record<string, unknown>;
}

function dispatchPluginMessage(message: PluginMessageEvent): void {
  window.dispatchEvent(new MessageEvent("message", { data: { pluginMessage: message } }));
}

describe("App analyze-button guards", () => {
  beforeEach(() => {
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("disables Analyze when no selection is active", async () => {
    render(<App />);
    const analyze = await screen.findByRole("button", { name: /Analyze( Selection)?|Analyzing|Canceling/i });
    expect(analyze.hasAttribute("disabled")).toBe(true);
    expect(analyze.getAttribute("title")).toMatch(/select a Frame/i);
  });

  it("enables Analyze when a selection is present", async () => {
    render(<App />);

    dispatchPluginMessage({ type: "SELECTION_STATUS", payload: { hasSelection: true } });

    // Button should be enabled and clickable (but we do not perform analysis here)
    const analyze = await screen.findByRole("button", { name: /Analyze( Selection)?/i });
    expect(analyze.hasAttribute("disabled")).toBe(false);
    analyze.click();

    await waitFor(() => {
      // After clicking, UI enters analyzing state and announces busy
      const main = document.querySelector("main.content");
      expect(main?.getAttribute("aria-busy")).toBe("true");
    });
  });
});
