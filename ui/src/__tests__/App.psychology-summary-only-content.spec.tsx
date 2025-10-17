import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanupApp,
  dispatchPluginMessage,
  renderApp,
  tick
} from "../../../tests/ui/testHarness";

describe("App psychology tab content rendering for summary-only payloads", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

  afterEach(() => {
    cleanupApp();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockClear();
  });

  it("renders a psychology card containing the summary text", async () => {
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

    const psychologyPanel = container.querySelector("#analysis-panel-psychology");
    expect(psychologyPanel?.hasAttribute("hidden")).toBe(false);

    const card = psychologyPanel?.querySelector(".psychology-card");
    expect(card).not.toBeNull();
    expect(card?.textContent).toContain("Curiosity gap applied to promote engagement.");
  });
});
