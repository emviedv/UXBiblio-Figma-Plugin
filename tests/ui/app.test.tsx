import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanupApp, dispatchPluginMessage, renderApp, tick } from "./testHarness";

afterEach(() => {
  cleanupApp();
  vi.restoreAllMocks();
});

describe("App UI resilience", () => {
  it("disables analyze button while analysis is in progress and restores after completion", async () => {
    const container = renderApp();

    const endpoint = "http://localhost:4115/api/analyze/figma";

    dispatchPluginMessage({
      type: "SELECTION_STATUS",
      payload: {
        hasSelection: true,
        selectionName: "Hero Frame",
        analysisEndpoint: endpoint
      }
    });

    await tick();

    const connectionIndicator = container.querySelector(
      ".connection-indicator"
    ) as HTMLSpanElement;
    expect(connectionIndicator).toBeDefined();
    expect(connectionIndicator.textContent).toContain(endpoint);

    let analyzeButton = container.querySelector(
      ".analyze-prompt .primary-button"
    ) as HTMLButtonElement;
    expect(analyzeButton).toBeDefined();
    expect(analyzeButton.disabled).toBe(false);
    expect(analyzeButton.textContent).toBe("Analyze Selection");

    dispatchPluginMessage({
      type: "ANALYSIS_IN_PROGRESS",
      payload: { selectionName: "Hero Frame" }
    });

    await tick();

    analyzeButton = container.querySelector(
      ".header .primary-button"
    ) as HTMLButtonElement;
    expect(analyzeButton.disabled).toBe(true);
    expect(analyzeButton.textContent).toBe("Analyzing…");

    const skeleton = container.querySelector(
      ".analysis-skeleton"
    ) as HTMLDivElement | null;
    expect(skeleton).not.toBeNull();
    expect(skeleton?.getAttribute("aria-busy")).toBe("true");

    const skeletonTitles = Array.from(
      skeleton?.querySelectorAll(".accordion-title") ?? []
    ).map((element) => element.textContent?.trim());
    expect(skeletonTitles).toEqual(
      expect.arrayContaining(["Heuristics", "Accessibility", "Psychology", "Impact", "Recommendations"])
    );

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: {
        selectionName: "Hero Frame",
        exportedAt: new Date().toISOString(),
        colors: [],
        analysis: {}
      }
    });

    await tick();

    analyzeButton = container.querySelector(".header .primary-button") as HTMLButtonElement;
    expect(analyzeButton.disabled).toBe(false);
    expect(analyzeButton.textContent).toBe("Analyze Selection");

    expect(container.querySelector(".analysis-skeleton")).toBeNull();
  });

  it("surfaces warnings using alert semantics for unsupported selections", async () => {
    const container = renderApp();

    dispatchPluginMessage({
      type: "SELECTION_STATUS",
      payload: {
        hasSelection: true,
        selectionName: "Group 1",
        warnings: ["Analysis works best on frames, groups, or components."]
      }
    });

    await tick();

    const banner = container.querySelector(".status-banner") as HTMLDivElement;
    expect(banner).toBeDefined();
    expect(banner.textContent).toMatch(/works best/);
    expect(banner.getAttribute("role")).toBe("alert");
    expect(document.activeElement).toBe(banner);
  });

  it("focuses the status banner on analysis errors and preserves timeout messaging", async () => {
    const container = renderApp();

    dispatchPluginMessage({
      type: "SELECTION_STATUS",
      payload: { hasSelection: true, selectionName: "Modal" }
    });

    await tick();

    dispatchPluginMessage({
      type: "ANALYSIS_ERROR",
      error: "Analysis took too long. Try again or simplify your selection."
    });

    await tick();

    const banner = container.querySelector(".status-banner") as HTMLDivElement;
    expect(banner).toBeDefined();
    expect(banner.textContent).toContain("Analysis took too long");
    expect(banner.getAttribute("role")).toBe("alert");
    expect(document.activeElement).toBe(banner);
  });

  it("renders accordions only for sections with data and exposes recommendations", async () => {
    const container = renderApp();

    const exportedAt = "2025-01-15T08:30:00.000Z";

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: {
        selectionName: "Checkout Flow",
        exportedAt,
        colors: [],
        analysis: {
          heuristics: [{ title: "Spacing", description: "Tight padding" }],
          accessibility: [],
          psychology: [],
          impact: [],
          recommendations: ["Increase contrast on primary CTA"]
        }
      }
    });

    await tick();

    const sectionButtons = Array.from(
      container.querySelectorAll(".accordion-button")
    ) as HTMLButtonElement[];
    const titles = sectionButtons.map((button) => button.textContent?.trim());
    expect(titles).toContain("Heuristics");
    expect(titles).toContain("Recommendations");
    expect(titles).not.toContain("Accessibility");
    expect(titles).not.toContain("Psychology");
    expect(titles).not.toContain("Impact");
  });

  it("renders heuristics when proxy response is nested under `analysis` field", async () => {
    const container = renderApp();

    const analysisResponse = {
      selectionName: "Search Results",
      analysis: {
        heuristics: [{ title: "Empty state", description: "Clarify empty query messaging." }],
        accessibility: [],
        psychology: [],
        impact: [],
        recommendations: []
      },
      metadata: { model: "gpt-test" }
    };

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: {
        selectionName: "Search Results",
        exportedAt: "2025-02-02T10:15:00.000Z",
        colors: [],
        analysis: analysisResponse
      }
    });

    await tick();

    const heuristicsHeader = Array.from(
      container.querySelectorAll(".accordion-button")
    ).find((button) => button.textContent?.includes("Heuristics"));
    expect(heuristicsHeader).toBeDefined();

    const heuristicsSection = Array.from(
      container.querySelectorAll(".accordion")
    ).find((section) =>
      section.querySelector(".accordion-title")?.textContent?.includes("Heuristics")
    );

    const heuristicsItem = heuristicsSection?.querySelector(".card-section-title");
    expect(heuristicsItem?.textContent).toContain("Empty state");
  });

  it("renders the UX summary with linked sources when provided", async () => {
    const container = renderApp();

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: {
        selectionName: "Billing Modal",
        exportedAt: "2025-03-01T12:00:00.000Z",
        colors: [],
        analysis: {
          summary: "OBS-1 highlights friction in the upgrade flow while OBS-3 notes delayed feedback.",
          receipts: [
            {
              title: "NN/g — Communicating System Status",
              url: "https://www.nngroup.com/articles/communicating-system-status/",
              domainTier: "T1",
              publishedYear: 2024,
              usedFor: "heuristics[1]"
            }
          ],
          heuristics: [],
          accessibility: [],
          psychology: [],
          impact: [],
          recommendations: []
        }
      }
    });

    await tick();

    const summaryHeading = container.querySelector(".summary-card .card-header h2");
    expect(summaryHeading?.textContent).toBe("UX Summary");

    const summaryParagraph = container.querySelector(".summary-card .summary-text p");
    const summaryText = summaryParagraph?.textContent ?? "";
    expect(summaryText).toContain("highlights friction");
    expect(summaryText).not.toContain("OBS-");

    const summarySourceLink = container.querySelector(
      ".summary-card .source-link"
    ) as HTMLAnchorElement | null;
    expect(summarySourceLink).not.toBeNull();
    expect(summarySourceLink?.getAttribute("href")).toBe(
      "https://www.nngroup.com/articles/communicating-system-status/"
    );
  });

  it("surfaces accessibility extras including contrast score, issues, and sources", async () => {
    const container = renderApp();

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: {
        selectionName: "Dashboard",
        exportedAt: "2025-04-12T09:00:00.000Z",
        colors: [],
        analysis: {
          heuristics: [],
          accessibility: {
            contrastScore: 4,
            summary: "OBS-2 indicates insufficient contrast on the primary CTA.",
            issues: ["WCAG 2.2 1.4.3 — CTA contrast below 4.5:1 (OBS-2)"],
            recommendations: ["Increase CTA text contrast to at least 4.5:1."],
            sources: [
              {
                title: "WCAG 2.2 — Contrast (Minimum)",
                url: "https://www.w3.org/TR/WCAG22/#contrast-minimum",
                domainTier: "T1",
                publishedYear: 2023,
                usedFor: "accessibility:contrast"
              }
            ]
          },
          psychology: [],
          impact: [],
          recommendations: []
        }
      }
    });

    await tick();

    const accessibilityCard = container.querySelector(".accessibility-card");
    expect(accessibilityCard).not.toBeNull();

    const contrastValue = accessibilityCard?.querySelector(".accessibility-contrast-value");
    expect(contrastValue?.textContent).toBe("4/5");

    const accessibilityLists = accessibilityCard?.querySelectorAll(".accessibility-list li");
    const accessibilityText = accessibilityLists?.[0]?.textContent ?? "";
    expect(accessibilityText).toContain("WCAG 2.2 1.4.3");
    expect(accessibilityText).not.toContain("OBS-");
    expect(accessibilityLists?.length).toBeGreaterThan(1);

    const accessibilitySourceLink = accessibilityCard?.querySelector(
      ".source-link"
    ) as HTMLAnchorElement | null;
    expect(accessibilitySourceLink?.getAttribute("href")).toBe(
      "https://www.w3.org/TR/WCAG22/#contrast-minimum"
    );
  });

  it("displays UX copywriting summary, guidance, and supporting sources", async () => {
    const container = renderApp();

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: {
        selectionName: "Pricing Modal",
        exportedAt: "2025-05-05T14:45:00.000Z",
        colors: [],
        analysis: {
          summary: "OBS-5 shows delayed reassurance after plan selection.",
          receipts: [],
          uxCopywriting: {
            heading: "UX Copywriting",
            summary: "OBS-4 suggests reinforcing the guarantee.\nOBS-6 highlights jargon confusion.",
            guidance: ["Lead with the guaranteed refund window.", "Swap jargon with user language."],
            sources: [
              {
                title: "NN/g — Writing Microcopy that Builds Trust",
                url: "https://www.nngroup.com/articles/microcopy-builds-trust/",
                domainTier: "T1",
                publishedYear: 2024,
                usedFor: "copywriting"
              }
            ]
          },
          heuristics: [],
          accessibility: [],
          psychology: [],
          impact: [],
          recommendations: []
        }
      }
    });

    await tick();

    const copywritingCard = container.querySelector(".copywriting-card");
    expect(copywritingCard).not.toBeNull();

    const copywritingParagraphs = copywritingCard?.querySelectorAll(".copywriting-summary p");
    expect(copywritingParagraphs?.length).toBe(2);
    const copywritingSummaryText = copywritingParagraphs?.[0]?.textContent ?? "";
    const copywritingSecondaryText = copywritingParagraphs?.[1]?.textContent ?? "";
    expect(copywritingSummaryText).toContain("reinforcing the guarantee");
    expect(copywritingSummaryText).not.toContain("OBS-");
    expect(copywritingSecondaryText).toContain("jargon confusion");
    expect(copywritingSecondaryText).not.toContain("OBS-");

    const guidanceItems = copywritingCard?.querySelectorAll(".copywriting-guidance li");
    expect(guidanceItems?.length).toBe(2);
    const guidanceText = guidanceItems?.[0]?.textContent ?? "";
    expect(guidanceText).toContain("Lead with the guaranteed refund window");
    expect(guidanceText).not.toContain("OBS-");

    const copywritingSourceLink = copywritingCard?.querySelector(
      ".source-link"
    ) as HTMLAnchorElement | null;
    expect(copywritingSourceLink?.getAttribute("href")).toBe(
      "https://www.nngroup.com/articles/microcopy-builds-trust/"
    );
  });

  it("shows the test connection control with the active endpoint in the footer", async () => {
    const container = renderApp();

    const endpoint = "http://localhost:4115/api/analyze/figma";

    dispatchPluginMessage({
      type: "SELECTION_STATUS",
      payload: {
        hasSelection: true,
        selectionName: "Checkout Flow",
        analysisEndpoint: endpoint
      }
    });

    await tick();

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: {
        selectionName: "Checkout Flow",
        exportedAt: "2025-01-15T08:30:00.000Z",
        colors: [{ hex: "#111111" }],
        analysis: {}
      }
    });

    await tick();

    const footer = container.querySelector(".footer") as HTMLDivElement;
    expect(footer).toBeDefined();

    const footerButtons = Array.from(footer.querySelectorAll("button")).map((button) =>
      button.textContent?.trim()
    );
    expect(footerButtons).toEqual(["Test Connection"]);

    const externalLink = footer.querySelector('a[href="https://uxbiblio.com"]');
    expect(externalLink).toBeNull();

    const connectionIndicator = footer.querySelector(".connection-indicator") as HTMLSpanElement;
    expect(connectionIndicator?.textContent).toContain("http://localhost:4115");
  });
});
