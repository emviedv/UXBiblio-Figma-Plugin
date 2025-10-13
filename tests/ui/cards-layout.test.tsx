import { afterEach, describe, expect, it } from "vitest";
import {
  cleanupApp,
  dispatchPluginMessage,
  dispatchRawPluginMessage,
  renderApp,
  tick
} from "./testHarness";

const ANALYSIS_RESULT_PAYLOAD = {
  selectionName: "Marketing Landing Page",
  exportedAt: "2025-01-15T12:00:00.000Z",
  analysis: {
    summary: "Line one\nLine two",
    receipts: [
      {
        title: "Nielsen's Heuristics",
        url: "https://example.com/heuristics",
        domainTier: "T1",
        publishedYear: 2024,
        usedFor: "heuristics"
      }
    ],
    uxCopywriting: {
      heading: "Microcopy",
      summary: "Short summary paragraph.",
      guidance: ["Use clear verbs", "Avoid jargon"],
      sources: [
        {
          title: "Copy Source",
          url: "https://example.com/copy"
        }
      ]
    },
    accessibility: {
      contrastScore: 3,
      summary: "Meets minimum contrast for body text.",
      issues: ["Low contrast on primary CTA", "Insufficient focus outline"],
      recommendations: ["Increase contrast to 4.5:1", "Add visible focus styles"],
      sources: []
    },
    flows: ["Primary Flow"],
    industries: ["Software as a Service"],
    uiElements: ["Call to Action", "Search Interface"],
    psychologyTags: ["User Delight"],
    heuristics: [
      { title: "Aesthetic and Minimalist Design", description: "Spacing feels cramped." }
    ],
    recommendations: [
      "Overall priority: High",
      "[Immediate] Fix CTA contrast",
      "[Long-term] Update help documentation",
      "Review QA process"
    ]
  }
};

afterEach(() => {
  cleanupApp();
});

async function renderWithAnalysis(): Promise<HTMLDivElement> {
  const container = renderApp();
  dispatchPluginMessage({
    type: "ANALYSIS_RESULT",
    payload: ANALYSIS_RESULT_PAYLOAD
  });
  await tick();
  return container;
}

describe("Card layout and section structure", () => {
  it("shows a progress skeleton during analysis without rendering color palette markup", async () => {
    const container = renderApp();
    dispatchPluginMessage({ type: "SELECTION_STATUS", payload: { hasSelection: true } });
    await tick();
    dispatchRawPluginMessage({
      type: "ANALYSIS_IN_PROGRESS",
      payload: {
        selectionName: "Example",
        colors: [
          { hex: "#336699", name: "Primary" },
          { hex: "#CC6633", name: "Secondary" }
        ]
      }
    });
    await tick();

    const skeleton = container.querySelector(
      '.analysis-panel-section[data-active="true"] [data-skeleton="true"][role="status"][aria-busy="true"]'
    );
    expect(skeleton).not.toBeNull();

    const paletteNodes = container.querySelector(".palette-grid, .palette-swatch, .summary-palette");
    expect(paletteNodes).toBeNull();
  });

  it("renders summary overview paragraphs, facet badges, and linked sources", async () => {
    const container = await renderWithAnalysis();

    const summaryTab = container.querySelector('[data-ux-tab="summary"]') as HTMLElement;
    const highlights = summaryTab.querySelectorAll('[data-ux-section="summary-overview"] .summary-paragraph');
    expect(highlights).toHaveLength(2);

    const facetGroups = Array.from(summaryTab.querySelectorAll("[data-facet-group]"));
    expect(facetGroups.length).toBeGreaterThan(0);

    const sourceLink = summaryTab.querySelector(".source-link") as HTMLAnchorElement;
    expect(sourceLink).toBeTruthy();
    expect(sourceLink.textContent?.trim()).toBe("Nielsen's Heuristics");
    expect(sourceLink.href).toContain("example.com/heuristics");
  });

  it("keeps copywriting summary and guidance lists grouped with consistent headings", async () => {
    const container = await renderWithAnalysis();

    const copywritingCard = container.querySelector(".copywriting-card") as HTMLElement;
    const headings = Array.from(
      copywritingCard.querySelectorAll(".card-section-title")
    ).map((node) => node.textContent?.trim());
    expect(headings).toEqual(["Summary", "Guidance", "Sources"]);

    const guidanceList = copywritingCard.querySelector(".copywriting-guidance") as HTMLUListElement;
    expect(guidanceList.tagName).toBe("UL");
    expect(guidanceList.querySelectorAll("li")).toHaveLength(2);
  });

  it("renders accessibility extras with separate issues and next steps lists", async () => {
    const container = await renderWithAnalysis();

    const accessibilityCard = container.querySelector(".accessibility-card") as HTMLElement;
    const sectionTitles = Array.from(
      accessibilityCard.querySelectorAll(".card-section-title")
    ).map((node) => node.textContent?.trim());
    expect(sectionTitles[0]).toBe("Issues & Next Steps");

    const subsectionTitles = Array.from(
      accessibilityCard.querySelectorAll(".accessibility-subsection-title")
    ).map((node) => node.textContent?.trim());
    expect(subsectionTitles).toEqual(["Issues", "Next Steps"]);

    const lists = accessibilityCard.querySelectorAll(".accessibility-list");
    expect(lists).toHaveLength(2);
    expect(lists[0].querySelectorAll("li")).toHaveLength(2);
    expect(lists[1].querySelectorAll("li")).toHaveLength(2);

    const contrast = accessibilityCard.querySelector(".accessibility-contrast-value");
    expect(contrast?.textContent).toBe("3/5");
  });

  it("partitions recommendations and avoids rendering palette swatches", async () => {
    const container = await renderWithAnalysis();

    const recommendationsAccordion = Array.from(
      container.querySelectorAll(".accordion")
    ).find((section) =>
      Array.from(section.querySelectorAll(".card-section-title")).some((n) =>
        (n.textContent || "").includes("Overall Priority")
      )
    ) as HTMLElement;

    const recommendationItems = Array.from(
      recommendationsAccordion.querySelectorAll(".card-item")
    ).map((item) => item.textContent?.trim());
    expect(recommendationItems[0]).toContain("High");
    expect(recommendationItems[1]).toContain("Fix CTA contrast");
    expect(recommendationItems[2]).toContain("Update help documentation");
    expect(recommendationItems[3]).toContain("Review QA process");

    const swatches = container.querySelectorAll(".palette-swatch, .palette-grid, .summary-palette");
    expect(swatches.length).toBe(0);
  });
});
