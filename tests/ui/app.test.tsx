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

    // Footer connection indicator removed; ensure not present
    const connectionIndicator = container.querySelector(
      ".connection-indicator"
    ) as HTMLSpanElement | null;
    expect(connectionIndicator).toBeNull();

    let analyzeButton = container.querySelector(".search-section .primary-button") as HTMLButtonElement;
    expect(analyzeButton).toBeDefined();
    expect(analyzeButton.disabled).toBe(false);
    expect(analyzeButton.getAttribute("aria-label")).toBe("Analyze");

    dispatchPluginMessage({
      type: "ANALYSIS_IN_PROGRESS",
      payload: { selectionName: "Hero Frame" }
    });

    await tick();

    analyzeButton = container.querySelector(
      ".search-section .primary-button"
    ) as HTMLButtonElement;
    expect(analyzeButton.disabled).toBe(true);
    expect(analyzeButton.getAttribute("aria-label")).toBe("Analyzing…");

    const analyzingNotice = container.querySelector(
      ".analysis-panel-section[data-active=\"true\"] .tab-empty-message"
    ) as HTMLParagraphElement | null;
    expect(analyzingNotice).not.toBeNull();
    expect(analyzingNotice?.textContent).toContain("Analyzing");
    expect(analyzingNotice?.textContent).toContain("Insights will appear here once ready.");

    const skeleton = container.querySelector(".analysis-skeleton");
    expect(skeleton).toBeNull();

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: {
        selectionName: "Hero Frame",
        exportedAt: new Date().toISOString(),
        analysis: {}
      }
    });

    await tick();

    analyzeButton = container.querySelector(".search-section .primary-button") as HTMLButtonElement;
    expect(analyzeButton.disabled).toBe(false);
    expect(analyzeButton.getAttribute("aria-label")).toBe("Analyze");

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

  it("renders accordions only for sections with data and exposes next steps", async () => {
    const container = renderApp();

    const exportedAt = "2025-01-15T08:30:00.000Z";

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: {
        selectionName: "Checkout Flow",
        exportedAt,
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

    const accordions = container.querySelectorAll(".accordion");
    expect(accordions.length).toBe(2);
    const accessibilityCard = container.querySelector(".accessibility-card");
    expect(accessibilityCard).toBeNull();
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
        analysis: analysisResponse
      }
    });

    await tick();

    const heuristicTitles = Array.from(
      container.querySelectorAll("#analysis-panel-heuristics .card-section-title")
    ).map((node) => node.textContent?.trim());
    expect(heuristicTitles).toContain("Empty state");
  });

  it("renders the UX summary with linked sources when provided", async () => {
    const container = renderApp();

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: {
        selectionName: "Billing Modal",
        exportedAt: "2025-03-01T12:00:00.000Z",
        analysis: {
          summary: [
            "Title: Billing Experience Health Check",
            "Description: OBS-1 highlights friction in the upgrade flow while OBS-3 notes delayed feedback.",
            "OBS-1 highlights friction in the upgrade flow while OBS-3 notes delayed feedback."
          ].join("\n"),
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

    // Card header title removed by design; validate content only

    const summaryTab = container.querySelector('[data-ux-tab="summary"]');
    expect(summaryTab).not.toBeNull();
    const summaryParagraphs = Array.from(
      summaryTab?.querySelectorAll('[data-ux-section="summary-overview"] .summary-paragraph') ?? []
    ).map((node) => node.textContent?.trim() ?? "");
    expect(summaryParagraphs).not.toHaveLength(0);
    expect(summaryParagraphs.some((text) => text.includes("highlights friction"))).toBe(true);
    expect(summaryParagraphs.some((text) => /^Title\b/i.test(text))).toBe(false);
    expect(summaryParagraphs.some((text) => /^Description\b/i.test(text))).toBe(false);
    expect(summaryParagraphs.join(" ")).not.toContain("OBS-");

    const summarySourceLink = summaryTab?.querySelector(
      ".summary-sources .source-link"
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
        analysis: {
          heuristics: [],
          accessibility: {
            contrastScore: 4,
            contrastStatus: "done",
            summary: "OBS-2 indicates insufficient contrast on the primary CTA, currently 3.2:1.",
            keyRecommendation: "Raise the CTA text color to #FFFFFF over the gradient to hit at least 4.5:1.",
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

    const contrastNote = accessibilityCard?.querySelector(".accessibility-contrast-note");
    expect(contrastNote?.textContent).toMatch(/low severity/i);

    const keyRecommendation = accessibilityCard?.querySelector(".accessibility-key .card-item-description")
      ?.textContent;
    expect(keyRecommendation).toContain("Raise the CTA text color");
    expect(keyRecommendation).not.toContain("OBS-");

    const overviewParagraph = accessibilityCard?.querySelector(".accessibility-summary")?.textContent ?? "";
    expect(overviewParagraph).toContain("3.2:1");
    expect(overviewParagraph).not.toContain("OBS-");

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
        analysis: {
          summary: "OBS-5 shows delayed reassurance after plan selection.",
          receipts: [],
          uxCopywriting: {
            heading: "UX Copy",
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

    const summarySection = copywritingCard?.querySelector<HTMLElement>(
      '[data-copywriting-section="messaging-summary"]'
    );
    expect(summarySection).not.toBeNull();
    const summaryParagraphs = summarySection?.querySelectorAll(".copywriting-summary p") ?? [];
    expect(summaryParagraphs.length).toBe(2);
    const copywritingSummaryText = summaryParagraphs[0]?.textContent ?? "";
    const copywritingSecondaryText = summaryParagraphs[1]?.textContent ?? "";
    expect(copywritingSummaryText).toContain("reinforcing the guarantee");
    expect(copywritingSummaryText).not.toContain("OBS-");
    expect(copywritingSecondaryText).toContain("jargon confusion");
    expect(copywritingSecondaryText).not.toContain("OBS-");

    const highImpactSection = copywritingCard?.querySelector<HTMLElement>(
      '[data-copywriting-section="high-impact"]'
    );
    expect(highImpactSection).not.toBeNull();
    const guidanceItems = highImpactSection?.querySelectorAll(".copywriting-guidance li") ?? [];
    expect(guidanceItems.length).toBe(2);
    const guidanceText = guidanceItems[0]?.textContent ?? "";
    expect(guidanceText).toContain("Lead with the guaranteed refund window");
    expect(guidanceText).not.toContain("OBS-");

    const copywritingSourceLink = copywritingCard?.querySelector(
      ".source-link"
    ) as HTMLAnchorElement | null;
    expect(copywritingSourceLink?.getAttribute("href")).toBe(
      "https://www.nngroup.com/articles/microcopy-builds-trust/"
    );
  });

  it("does not render a test connection footer", async () => {
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
        analysis: {}
      }
    });

    await tick();

    const footer = container.querySelector(".footer") as HTMLDivElement | null;
    expect(footer).toBeNull();
  });
});
