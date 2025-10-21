import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { within } from "@testing-library/dom";
import { logger } from "@shared/utils/logger";
import {
  cleanupApp,
  dispatchPluginMessage,
  renderApp,
  tick
} from "../../../../tests/ui/testHarness";

/**
 * Contract-focused checks for the App ↔ runtime message bridge.
 *
 * Single-file command:
 * npx vitest run tests/client/app.contract.test.ts
 */
describe("App ↔ runtime contract", () => {
  let container: HTMLDivElement;
  let postMessageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    container = renderApp();
    postMessageSpy = vi.spyOn(window.parent, "postMessage");
  });

  afterEach(() => {
    postMessageSpy.mockRestore();
    cleanupApp();
    vi.restoreAllMocks();
  });

  it("normalizes selection credits and forwards normalized auth status to the runtime", async () => {
    dispatchPluginMessage({
      type: "SELECTION_STATUS",
      payload: {
        hasSelection: true,
        selectionName: "Marketing Flow",
        warnings: [],
        analysisEndpoint: "http://localhost:4115/api",
        credits: {
          totalFreeCredits: 2.7,
          remainingFreeCredits: 12,
          accountStatus: " Pro "
        }
      }
    });

    await tick();

    const accountBannerCopy = container.querySelector(".analysis-grid-banner-copy");
    expect(accountBannerCopy?.textContent).toContain("Signed in");

    const analyzeButton = within(container).getByRole("button", { name: "Analyze" });
    expect(analyzeButton.hasAttribute("disabled")).toBe(false);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "uxbiblio:auth-status",
          payload: { status: "trialing" }
        },
        origin: "https://app.uxbiblio.local"
      })
    );

    await tick();

    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        pluginMessage: {
          type: "SYNC_ACCOUNT_STATUS",
          payload: { status: "trial" }
        }
      },
      "*"
    );
  });

  it("ignores unknown auth tokens without mutating the banner state", async () => {
    const debugSpy = vi.spyOn(logger, "debug");

    dispatchPluginMessage({
      type: "SELECTION_STATUS",
      payload: {
        hasSelection: true,
        selectionName: "Checkout Flow",
        warnings: [],
        credits: {
          totalFreeCredits: 1,
          remainingFreeCredits: 0,
          accountStatus: "anonymous"
        }
      }
    });

    await tick();

    const bannerBefore = container.querySelector(".analysis-grid-banner")?.textContent ?? "";

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "uxbiblio:auth-status",
          payload: { status: "mystery-tier" }
        },
        origin: "https://app.uxbiblio.local"
      })
    );

    await tick();

    expect(postMessageSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        pluginMessage: expect.objectContaining({ type: "SYNC_ACCOUNT_STATUS" })
      }),
      "*"
    );

    const bannerAfter = container.querySelector(".analysis-grid-banner")?.textContent ?? "";
    expect(bannerAfter).toBe(bannerBefore);

    expect(debugSpy).toHaveBeenCalledWith(
      "[AuthBridge] Unrecognized account status token",
      expect.objectContaining({ candidate: "mystery-tier" })
    );
  });
});
