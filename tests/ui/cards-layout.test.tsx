import { afterEach, describe, expect, it } from "vitest";
import {
  cleanupApp,
  dispatchPluginMessage,
  renderApp,
  tick
} from "./testHarness";

const ANALYSIS_RESULT_PAYLOAD = {
  selectionName: "Marketing Landing Page",
  exportedAt: "2025-01-15T12:00:00.000Z",
  analysis: {
    scopeNote: "OBS-1: hero headline. OBS-2: CTA footnote. OBS-3: trial badge.",
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
      contrastStatus: "done",
      summary: "Meets minimum contrast for body text.",
      keyRecommendation: "Prioritize the CTA contrast update to prevent AA violations.",
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
    ],
    uxSignals: ["Conversion friction", "Trust opportunity"]
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
  it("shows a progress skeleton during analysis before results arrive", async () => {
    const container = renderApp();
    dispatchPluginMessage({ type: "SELECTION_STATUS", payload: { hasSelection: true } });
    await tick();
    dispatchPluginMessage({
      type: "ANALYSIS_IN_PROGRESS",
      payload: {
        selectionName: "Example"
      }
    });
    await tick();

    const skeleton = container.querySelector(
      '.analysis-panel-section[data-active="true"] [data-skeleton="true"][role="status"][aria-busy="true"]'
    );
    expect(skeleton).not.toBeNull();

    const signalsList = container.querySelector('[data-ux-section="summary-signals"]');
    expect(signalsList).toBeNull();
  });

  it("renders summary overview paragraphs, facet badges, and linked sources", async () => {
    const container = await renderWithAnalysis();

    const summaryTab = container.querySelector('[data-ux-tab="summary"]') as HTMLElement;
    const highlights = summaryTab.querySelectorAll('[data-ux-section="summary-overview"] .summary-paragraph');
    expect(highlights).toHaveLength(3);

    const facetGroups = Array.from(summaryTab.querySelectorAll("[data-facet-group]"));
    expect(facetGroups.length).toBeGreaterThan(0);

    const signalsList = summaryTab.querySelector('[data-ux-section="summary-signals"]');
    expect(signalsList).not.toBeNull();
    expect(signalsList?.querySelectorAll("li")).toHaveLength(2);

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
    expect(headings).toEqual([
      "Messaging Summary",
      "High-Impact Copy Opportunities",
      "Long-term Messaging Bets",
      "Notable On-screen Copy",
      "Sources"
    ]);

    const highImpactSection = copywritingCard.querySelector<HTMLElement>(
      '[data-copywriting-section="high-impact"]'
    );
    expect(highImpactSection).not.toBeNull();
    const guidanceList = highImpactSection?.querySelector(".copywriting-guidance") as HTMLUListElement | null;
    expect(guidanceList?.tagName).toBe("UL");
    expect(guidanceList?.querySelectorAll("li")).toHaveLength(2);
  });

  it("renders accessibility extras with dedicated contrast, key recommendation, and follow-up sections", async () => {
    const container = await renderWithAnalysis();

    const accessibilityCard = container.querySelector(".accessibility-card") as HTMLElement;
    const sectionTitles = Array.from(accessibilityCard.querySelectorAll(".card-section-title")).map((node) =>
      node.textContent?.trim()
    );
    expect(sectionTitles.slice(0, 4)).toEqual([
      "Overall Contrast",
      "Key Recommendation",
      "Issues",
      "Recommendations"
    ]);

    const contrast = accessibilityCard.querySelector(".accessibility-contrast-value");
    expect(contrast?.textContent).toBe("3/5");

    const keyRec = accessibilityCard
      .querySelector(".accessibility-key .card-item-description")
      ?.textContent?.trim();
    expect(keyRec).toContain("Prioritize the CTA contrast update");

    const accessibilityLists = accessibilityCard.querySelectorAll(".accessibility-list");
    expect(accessibilityLists).toHaveLength(2);
    const issuesList = accessibilityLists[0];
    const recList = accessibilityLists[1];
    expect(issuesList.querySelectorAll("li")).toHaveLength(2);
    expect(recList.querySelectorAll("li")).toHaveLength(2);
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

    const legacySwatches = container.querySelectorAll(".palette-swatch, .palette-grid, .summary-palette");
    expect(legacySwatches.length).toBe(0);
    const paletteTab = container.querySelector('.tab-surface.color-palette-tab');
    expect(paletteTab).toBeNull();
    const inlinePalette = container.querySelector('[data-inline-palette="true"]');
    expect(inlinePalette).toBeNull();
  });
});
