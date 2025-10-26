import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import {
  act,
  cleanupApp,
  dispatchPluginMessageAndFlush,
  renderApp,
  tick
} from "../../../tests/ui/testHarness";

describe("App analyze-button guards", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanupApp();
    const actWarnings = consoleErrorSpy.mock.calls
      .map((call) => call[0])
      .filter((message) =>
        typeof message === "string" && message.includes("not wrapped in act")
      );
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();

    if (actWarnings.length > 0) {
      throw new Error(`React act warnings detected: ${actWarnings.join(" | ")}`);
    }
  });

  it("disables Analyze when no selection is active", async () => {
    const container = renderApp();
    await tick();

    const analyze = container.querySelector(".search-section .primary-button") as HTMLButtonElement;
    expect(analyze).toBeTruthy();
    expect(analyze.disabled).toBe(true);
    expect(analyze.getAttribute("title")).toMatch(/select a Frame/i);
  });

  it("enables Analyze when a selection is present", async () => {
    const container = renderApp();
    await tick();

    await dispatchPluginMessageAndFlush({
      type: "SELECTION_STATUS",
      payload: { hasSelection: true }
    });

    const analyze = container.querySelector(".search-section .primary-button") as HTMLButtonElement;
    expect(analyze).toBeTruthy();
    expect(analyze.disabled).toBe(false);

    await act(async () => {
      analyze.click();
      await Promise.resolve();
    });

    await waitFor(() => {
      // After clicking, UI enters analyzing state and announces busy
      const main = container.querySelector("main.content");
      expect(main?.getAttribute("aria-busy")).toBe("true");
    });
  });
});
