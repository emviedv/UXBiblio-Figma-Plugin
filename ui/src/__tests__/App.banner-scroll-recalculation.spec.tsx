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

class MockResizeObserver {
  private readonly targets = new Set<Element>();
  constructor(
    private readonly callback: (entries: Array<{ target: Element }>, observer: MockResizeObserver) => void
  ) {}

  observe(target: Element): void {
    this.targets.add(target);
    if (target instanceof HTMLElement && target.classList.contains("status-banner")) {
      this.callback([{ target }], this);
    }
  }

  unobserve(target: Element): void {
    this.targets.delete(target);
  }

  disconnect(): void {
    this.targets.clear();
  }
}

describe("Analysis panel sticky metrics refresh", () => {
  const originalInnerHeight = window.innerHeight;
  let originalGetBoundingRect: typeof HTMLElement.prototype.getBoundingClientRect;
  let originalResizeObserver: typeof window.ResizeObserver;
  let originalRequestAnimationFrame: typeof window.requestAnimationFrame;
  let originalCancelAnimationFrame: typeof window.cancelAnimationFrame;

  beforeEach(() => {
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => {
      throw new Error("Unexpected console.error during test run");
    });

    originalGetBoundingRect = HTMLElement.prototype.getBoundingClientRect;
    originalResizeObserver = window.ResizeObserver;
    originalRequestAnimationFrame = window.requestAnimationFrame;
    originalCancelAnimationFrame = window.cancelAnimationFrame;

    Object.defineProperty(window, "innerHeight", { writable: true, value: 720 });
    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    window.cancelAnimationFrame = vi.fn();
    window.ResizeObserver = MockResizeObserver as unknown as typeof window.ResizeObserver;

    const measurements = [
      { top: 120, height: 600 },
      { top: 120, height: 600 },
      { top: 80, height: 600 }
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
      return new DOMRect(0, snapshot.top, 1024, snapshot.height);
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

  it("updates sticky offset when status banner appears", async () => {
    const { container } = render(<App />);

    await act(async () => {
      dispatchPluginMessage({ type: "SELECTION_STATUS", payload: { hasSelection: true } });
      dispatchPluginMessage({
        type: "ANALYSIS_RESULT",
        payload: {
          selectionName: "Reflow Test",
          analysis: {
            analysis: {
              heuristics: Array.from({ length: 8 }, (_, index) => ({
                title: `Heuristic ${index + 1}`,
                description: "Detailed content to enforce tall panel."
              }))
            }
          }
        }
      });
    });

    const grid = await waitFor(() => container.querySelector<HTMLDivElement>(".analysis-grid"));
    expect(grid).not.toBeNull();

    await waitFor(() => {
      expect(grid!.style.getPropertyValue("--analysis-sticky-offset")).toBe("120px");
    });

    await act(async () => {
      dispatchPluginMessage({
        type: "SELECTION_STATUS",
        payload: {
          hasSelection: true,
          warnings: ["Connectivity lag detected."]
        }
      });
    });

    await waitFor(() => {
      expect(grid!.style.getPropertyValue("--analysis-sticky-offset")).toBe("80px");
    });
  });
});
