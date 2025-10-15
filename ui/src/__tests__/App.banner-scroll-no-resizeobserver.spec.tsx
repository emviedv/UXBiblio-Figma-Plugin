import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import App from "../App";

interface PluginMessageEvent {
  type: string;
  payload?: Record<string, unknown>;
}

function dispatchPluginMessage(message: PluginMessageEvent): void {
  window.dispatchEvent(new MessageEvent("message", { data: { pluginMessage: message } }));
}

describe("Analysis panel resilience without ResizeObserver", () => {
  const originalInnerHeight = window.innerHeight;
  const originalResizeObserver = window.ResizeObserver;
  let originalGetBoundingRect: typeof HTMLElement.prototype.getBoundingClientRect;
  let originalRequestAnimationFrame: typeof window.requestAnimationFrame;
  let originalCancelAnimationFrame: typeof window.cancelAnimationFrame;

  beforeEach(() => {
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => {
      throw new Error("Unexpected console.error during test run");
    });

    originalGetBoundingRect = HTMLElement.prototype.getBoundingClientRect;
    originalRequestAnimationFrame = window.requestAnimationFrame;
    originalCancelAnimationFrame = window.cancelAnimationFrame;

    Object.defineProperty(window, "innerHeight", { writable: true, value: 648 });

    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    window.cancelAnimationFrame = vi.fn();
    window.ResizeObserver = undefined as unknown as typeof ResizeObserver;

    const measurements = [
      { top: 96, height: 560 },
      { top: 96, height: 560 },
      { top: 72, height: 560 }
    ];
    let callCount = 0;

    HTMLElement.prototype.getBoundingClientRect = function patched(): DOMRect {
      if (!(this instanceof HTMLElement) || !this.classList.contains("analysis-grid")) {
        return originalGetBoundingRect.call(this);
      }
      const snapshot = measurements[Math.min(callCount, measurements.length - 1)];
      if (callCount < measurements.length - 1) {
        callCount += 1;
      }
      return new DOMRect(0, snapshot.top, 960, snapshot.height);
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "innerHeight", { writable: true, value: originalInnerHeight });
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingRect;
    window.ResizeObserver = originalResizeObserver;
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it("recomputes sticky metrics when banner toggles and ResizeObserver is unavailable", async () => {
    const { container } = render(<App />);

    await act(async () => {
      dispatchPluginMessage({ type: "SELECTION_STATUS", payload: { hasSelection: true } });
      dispatchPluginMessage({
        type: "ANALYSIS_RESULT",
        payload: {
          selectionName: "Legacy Runtime",
          analysis: {
            analysis: {
              heuristics: Array.from({ length: 5 }, (_, index) => ({
                title: `Legacy ${index + 1}`,
                description: "Forces scroll height."
              }))
            }
          }
        }
      });
    });

    const grid = await waitFor(() => container.querySelector<HTMLDivElement>(".analysis-grid"));
    expect(grid).not.toBeNull();

    await waitFor(() => {
      expect(grid!.style.getPropertyValue("--analysis-sticky-offset")).toBe("96px");
    });

    await act(async () => {
      dispatchPluginMessage({
        type: "SELECTION_STATUS",
        payload: {
          hasSelection: true,
          warnings: ["Legacy environment requires attention."]
        }
      });
    });

    await waitFor(() => {
      expect(grid!.style.getPropertyValue("--analysis-sticky-offset")).toBe("72px");
    });
  });
});
