import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import {
  cleanupApp,
  dispatchPluginMessage,
  dispatchRawPluginMessage,
  renderApp,
  tick
} from "../../../tests/ui/testHarness";

const BASE_SELECTION = { hasSelection: true, selectionName: "Marketing Landing Page" } as const;

const LEGACY_COLORS = [
  { hex: "#336699", name: "Primary" },
  { hex: "#CC6633", name: "Accent" }
] as const;

const BASE_ANALYSIS_RESULT = {
  selectionName: "Marketing Landing Page",
  analysis: {
    summary: "Compelling hero copy captures attention and conveys the core offer succinctly.",
    receipts: [
      {
        title: "Nielsen's Heuristics",
        url: "https://nngroup.com/articles/ten-usability-heuristics",
        usedFor: "heuristics"
      }
    ],
    uxCopywriting: {
      summary: "Ensure headings and CTAs ladder up to the same benefit statement.",
      guidance: ["Keep verb-first actions consistent across CTA variants."],
      sources: []
    },
    heuristics: [
      { title: "Consistency and standards", description: "Align hero CTA styling across variants." }
    ],
    psychology: [{ title: "Curiosity Gap — Intentional", description: "Prime interest via teaser copy." }],
    recommendations: ["Document a reusable CTA pattern."],
    flows: ["Onboarding"],
    industries: ["SaaS"],
    uiElements: ["Hero Banner"],
    psychologyTags: ["Motivation"],
    suggestedTitle: "Streamlined Marketing Hero",
    suggestedTags: ["ux-summary"]
  },
  exportedAt: "2025-01-15T12:00:00.000Z"
} as const;

describe("App: Color Palette feature fully removed", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
    cleanupApp();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      throw new Error(["Unexpected console.error:", ...args].join(" "));
    });
  });

  afterEach(() => {
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
    cleanupApp();
    vi.restoreAllMocks();
  });

  it("does not render a color palette section in the UX Summary tab after analysis completes", async () => {
    const container = renderApp();

    dispatchPluginMessage({ type: "SELECTION_STATUS", payload: BASE_SELECTION });
    await tick();

    dispatchRawPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: { ...BASE_ANALYSIS_RESULT, colors: LEGACY_COLORS }
    });
    await tick();

    const summaryPanel = container.querySelector("#analysis-panel-ux-summary");
    expect(summaryPanel).not.toBeNull();

    const paletteSection =
      summaryPanel?.querySelector(".summary-palette, [data-ux-section=\"summary-palette\"], .palette-grid");
    expect(paletteSection).toBeNull();

    const paletteHeading = Array.from(summaryPanel?.querySelectorAll("h2, h3, h4") ?? []).find((node) =>
      node.textContent?.toLowerCase().includes("color")
    );
    expect(paletteHeading).toBeUndefined();

    const swatch = summaryPanel?.querySelector(".palette-swatch, .swatch");
    expect(swatch).toBeNull();
  });

  it("does not surface live color palette content while analysis is in progress, even when colors stream in", async () => {
    const container = renderApp();

    dispatchPluginMessage({ type: "SELECTION_STATUS", payload: BASE_SELECTION });
    await tick();

    dispatchRawPluginMessage({
      type: "ANALYSIS_IN_PROGRESS",
      payload: {
        selectionName: BASE_SELECTION.selectionName,
        colors: LEGACY_COLORS
      }
    });
    await tick();

    const summaryPanel = container.querySelector("#analysis-panel-ux-summary");
    expect(summaryPanel).not.toBeNull();

    const livePalette =
      summaryPanel?.querySelector(".palette-grid, [data-ux-section=\"summary-palette\"], .palette-swatch");
    expect(livePalette).toBeNull();

    const statusSkeleton = summaryPanel?.querySelector('[data-skeleton="true"][role="status"][aria-busy="true"]');
    expect(statusSkeleton).not.toBeNull();
  });

  it("avoids leaving palette markup anywhere in the DOM across tab switches and repeated runs", async () => {
    const container = renderApp();

    dispatchPluginMessage({ type: "SELECTION_STATUS", payload: BASE_SELECTION });
    await tick();

    dispatchRawPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: { ...BASE_ANALYSIS_RESULT, colors: LEGACY_COLORS }
    });
    await tick();

    const heuristicsTab = container.querySelector<HTMLButtonElement>("#analysis-tab-heuristics");
    expect(heuristicsTab).not.toBeNull();
    act(() => heuristicsTab!.click());
    await tick();

    dispatchRawPluginMessage({
      type: "ANALYSIS_IN_PROGRESS",
      payload: {
        selectionName: "Marketing Landing Page — second run",
        colors: LEGACY_COLORS
      }
    });
    await tick();

    const heuristicsPanel = container.querySelector("#analysis-panel-heuristics");
    expect(heuristicsPanel).not.toBeNull();

    const strayPalette =
      heuristicsPanel?.querySelector(".palette-grid, [data-ux-section=\"summary-palette\"], .palette-swatch");
    expect(strayPalette).toBeNull();

    const anyPaletteNodes = container.querySelector(".palette-grid, [data-ux-section=\"summary-palette\"], .palette-swatch");
    expect(anyPaletteNodes).toBeNull();
  });
});
