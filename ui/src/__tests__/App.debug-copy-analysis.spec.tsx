import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import {
  cleanupApp,
  dispatchPluginMessage,
  renderApp,
  tick
} from "../../../tests/ui/testHarness";

const ANALYSIS_RESULT_PAYLOAD = {
  selectionName: "Marketing Landing Page",
  analysis: {
    summary: "Hero copy aligns with the primary conversion goal.",
    recommendations: ["Highlight the free trial in the hero headline."]
  },
  exportedAt: "2025-01-15T12:00:00.000Z"
} as const;

describe("App debug copy analysis control", () => {
  let restoreClipboard: (() => void) | undefined;

  beforeEach(() => {
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      throw new Error(["Unexpected console.error:", ...args].join(" "));
    });
    cleanupApp();
    restoreClipboard = undefined;
  });

  afterEach(() => {
    restoreClipboard?.();
    restoreClipboard = undefined;
    cleanupApp();
    vi.restoreAllMocks();
  });

  it("keeps the copy button disabled until an analysis result arrives", async () => {
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: /Expand sidebar/i }));

    const copyButton = await screen.findByRole("button", { name: /Copy analysis JSON/i });
    expect(copyButton.hasAttribute("disabled")).toBe(true);

    dispatchPluginMessage({
      type: "SELECTION_STATUS",
      payload: { hasSelection: true, selectionName: "Marketing Landing Page" }
    });
    await tick();

    dispatchPluginMessage({ type: "ANALYSIS_RESULT", payload: ANALYSIS_RESULT_PAYLOAD });
    await tick();

    const enabledCopyButton = screen.getByRole("button", { name: /Copy analysis JSON/i });
    expect(enabledCopyButton.hasAttribute("disabled")).toBe(false);
  });

  it("writes the analysis payload to the clipboard and announces success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = (navigator as typeof navigator & { clipboard?: Clipboard }).clipboard;

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    restoreClipboard = () => {
      if (originalClipboard) {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: originalClipboard
        });
      } else {
        delete (navigator as typeof navigator & { clipboard?: Clipboard }).clipboard;
      }
    };

    renderApp();

    fireEvent.click(screen.getByRole("button", { name: /Expand sidebar/i }));

    dispatchPluginMessage({
      type: "SELECTION_STATUS",
      payload: { hasSelection: true, selectionName: "Marketing Landing Page" }
    });
    await tick();

    dispatchPluginMessage({ type: "ANALYSIS_RESULT", payload: ANALYSIS_RESULT_PAYLOAD });
    await tick();

    const copyButton = screen.getByRole("button", { name: /Copy analysis JSON/i });
    fireEvent.click(copyButton);
    await tick();

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain('"selectionName": "Marketing Landing Page"');

    const statusMessage = await screen.findByText("Copied analysis JSON.");
    expect(statusMessage).toBeTruthy();
  });
});
