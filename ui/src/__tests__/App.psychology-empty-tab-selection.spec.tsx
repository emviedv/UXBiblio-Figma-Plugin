import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanupApp,
  dispatchPluginMessage,
  renderApp,
  tick
} from "../../../tests/ui/testHarness";

describe("App psychology tab selection when analysis yields no psychology entries", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

  afterEach(() => {
    cleanupApp();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockClear();
  });

  it("keeps psychology tab active instead of reverting to UX Summary", async () => {
    const container = renderApp();

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: {
        selectionName: "Chrome Capture",
        exportedAt: "2025-01-15T12:00:00.000Z",
        analysis: {
          summary: "Top insight",
          receipts: [],
          uxCopywriting: { heading: "", summary: "", guidance: [], sources: [] },
          heuristics: [],
          accessibility: [],
          psychology: {
            summary: "Curiosity gap applied to promote engagement."
          },
          impact: [],
          recommendations: []
        }
      }
    });
    await tick();

    const psychologyTab = container.querySelector<HTMLButtonElement>("#analysis-tab-psychology");
    expect(psychologyTab).not.toBeNull();

    act(() => psychologyTab!.click());
    await tick();

    expect(psychologyTab?.getAttribute("aria-selected")).toBe("true");
    const psychologyPanel = container.querySelector("#analysis-panel-psychology");
    expect(psychologyPanel?.hasAttribute("hidden")).toBe(false);
  });
});
