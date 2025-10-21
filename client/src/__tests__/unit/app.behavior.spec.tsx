import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { within } from "@testing-library/dom";
import {
  cleanupApp,
  dispatchPluginMessage,
  renderApp,
  tick,
  act
} from "../../../../tests/ui/testHarness";

/**
 * Characterization suite for the legacy App container.
 * These tests lock current UX + accessibility contracts prior to refactors.
 *
 * Single-file command:
 * npx vitest run client/src/__tests__/unit/app.behavior.spec.tsx
 */
describe("App (characterization)", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = renderApp();
  });

  afterEach(() => {
    cleanupApp();
  });

  it("keeps Analyze disabled without a selection and surfaces the guidance tooltip", async () => {
    await tick();

    const searchRegion = within(container).getByRole("region", { name: "Search and Analyze" });
    const analyzeButton = within(searchRegion).getByRole("button", { name: "Analyze" });

    expect(analyzeButton.hasAttribute("disabled")).toBe(true);
    expect(analyzeButton.getAttribute("title")).toContain("select a Frame");
    expect(analyzeButton.getAttribute("aria-label")).toBe("Analyze");
  });

  it("marks Analyze unavailable when free credits are exhausted and announces the account banner", async () => {
    dispatchPluginMessage({
      type: "SELECTION_STATUS",
      payload: {
        hasSelection: true,
        selectionName: "Checkout Flow",
        credits: {
          totalFreeCredits: 5,
          remainingFreeCredits: 0,
          accountStatus: "anonymous"
        }
      }
    });

    await tick();

    const searchRegion = within(container).getByRole("region", { name: "Search and Analyze" });
    const analyzeButton = within(searchRegion).getByRole("button", { name: "Analyze" });
    expect(analyzeButton.hasAttribute("disabled")).toBe(true);
    expect(analyzeButton.getAttribute("title")).toContain("No credits remaining");

    const accountBanner = container.querySelector(".analysis-grid-banner");
    expect(accountBanner?.getAttribute("role")).toBe("status");
    expect(accountBanner?.textContent).toContain("No credits remaining");
    expect(accountBanner?.textContent).toContain("Sign in");
  });

  it("restores the UX Summary tab when the active tab loses content outside of analysis states", async () => {
    dispatchPluginMessage({
      type: "SELECTION_STATUS",
      payload: {
        hasSelection: true,
        selectionName: "Research Study",
        credits: {
          totalFreeCredits: 0,
          remainingFreeCredits: 0,
          accountStatus: "pro"
        }
      }
    });

    await tick();

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: {
        selectionName: "Research Study",
        exportedAt: new Date().toISOString(),
        frameCount: 1,
        analysis: {
          summary: "Key flows performing as expected.",
          psychology: [
            {
              title: "Curiosity Gap — Intentional",
              summary: "Subtle headline animation sparks curiosity."
            }
          ]
        }
      }
    });

    await tick();

    const tablist = within(container).getByRole("tablist");
    const psychologyTab = within(tablist).getByRole("tab", { name: "Psychology" });
    act(() => {
      psychologyTab.click();
    });

    await tick();

    let activePanel = container.querySelector(".analysis-panel-section[data-active=\"true\"]");
    expect(activePanel?.getAttribute("aria-labelledby")).toBe("analysis-tab-psychology");

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: {
        selectionName: "Research Study",
        exportedAt: new Date().toISOString(),
        frameCount: 1,
        analysis: {
          summary: "Updated insights available."
        }
      }
    });

    await tick();

    activePanel = container.querySelector(".analysis-panel-section[data-active=\"true\"]");
    expect(activePanel?.getAttribute("aria-labelledby")).toBe("analysis-tab-ux-summary");

    const activeSummaryTab = within(tablist).getByRole("tab", { name: "UX Summary" });
    expect(activeSummaryTab.getAttribute("aria-selected")).toBe("true");
  });
});
