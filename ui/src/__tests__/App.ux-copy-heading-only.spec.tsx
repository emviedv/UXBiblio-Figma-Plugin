import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  cleanupApp,
  dispatchPluginMessage,
  renderApp,
  tick
} from "../../../tests/ui/testHarness";

const ANALYSIS_RESULT_WITH_HEADING_ONLY = {
  selectionName: "Guarantee Modal",
  exportedAt: "2025-05-05T11:25:00.000Z",
  analysis: {
    summary: "OBS-1 indicates users hesitate before committing to the guarantee.",
    receipts: [],
    uxCopywriting: {
      heading: "Guarantee Messaging",
      summary: undefined,
      guidance: [],
      sources: []
    },
    heuristics: [],
    accessibility: [],
    psychology: [],
    impact: [],
    recommendations: []
  }
} as const;

let originalConsoleError: typeof console.error;

beforeAll(() => {
  originalConsoleError = console.error;
  console.error = (...args: Parameters<typeof console.error>) => {
    originalConsoleError(...args);
    throw new Error(
      `Unexpected console.error during App UX Copy heading-only test: ${args
        .map((value) => String(value))
        .join(" ")}`
    );
  };
});

afterAll(() => {
  console.error = originalConsoleError;
});

afterEach(() => {
  cleanupApp();
});

describe("App UX Copy tab", () => {
  it("renders the UX Copy card when only a heading is available", async () => {
    const container = renderApp();

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: ANALYSIS_RESULT_WITH_HEADING_ONLY
    });

    await tick();

    const copywritingCard = container.querySelector(".copywriting-card");
    expect(copywritingCard).not.toBeNull();
  });
});
