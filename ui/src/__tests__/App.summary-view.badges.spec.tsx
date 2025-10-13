import { afterEach, describe, expect, it } from "vitest";
import {
  cleanupApp,
  dispatchPluginMessage,
  renderApp,
  tick
} from "../../../tests/ui/testHarness";

const BASE_ANALYSIS_RESULT = {
  selectionName: "Search & Discovery Flow",
  exportedAt: "2025-03-19T19:15:00.000Z",
  colors: [],
  analysis: {
    summary: "The analysis summary paragraph should surface in the overview.",
    receipts: [],
    uxCopywriting: {
      heading: "Messaging Summary",
      summary: "Copywriting summary example paragraph.",
      guidance: ["Use clearer CTA labels."],
      sources: []
    },
    heuristics: [],
    accessibility: [],
    psychology: [],
    impact: [],
    recommendations: [],
    flows: ["Browsing & Filtering"],
    industries: ["Software as a Service"],
    uiElements: ["Call to Action", "Testimonials", "Search Interface", "Navigation Menu"],
    psychologyTags: ["User Delight"]
  }
};

afterEach(() => {
  cleanupApp();
});

describe("App UX Summary tab", () => {
  it("renders the new summary heading, overview copy, and grouped facet badges", async () => {
    const container = renderApp();

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: BASE_ANALYSIS_RESULT
    });
    await tick();

    const summaryHeading = container.querySelector<HTMLElement>('[data-ux-section="summary-heading"]');
    expect(summaryHeading?.textContent?.trim()).toBe("UX Analysis Summary");

    const overview = container.querySelector('[data-ux-section="summary-overview"]');
    expect(overview?.textContent).toContain("The analysis summary paragraph");

    const facetGroups = Array.from(
      container.querySelectorAll<HTMLElement>("[data-facet-group]")
    ).map((node) => ({
      category: node.getAttribute("data-facet-group"),
      badges: Array.from(node.querySelectorAll<HTMLElement>("[data-badge-tone]")).map((badge) =>
        badge.textContent?.trim()
      )
    }));

    expect(facetGroups).toEqual([
      {
        category: "flows",
        badges: ["Browsing & Filtering"]
      },
      {
        category: "industries",
        badges: ["Software as a Service"]
      },
      {
        category: "ui-elements",
        badges: ["Call to Action", "Testimonials", "Search Interface", "Navigation Menu"]
      },
      {
        category: "psychology",
        badges: ["User Delight"]
      }
    ]);

    const gradientBadge = container.querySelector('[data-badge-tone="flows"]');
    expect(gradientBadge).not.toBeNull();
  });
});
