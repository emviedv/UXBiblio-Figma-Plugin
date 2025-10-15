import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AnalysisTabDescriptor } from "../../types/analysis-tabs";
import { AnalysisTabsLayout } from "../../components/layout/AnalysisTabsLayout";
import { logger } from "@shared/utils/logger";

type ResizeObserverCallback = (entries: ResizeObserverEntry[], observer: ResizeObserver) => void;

const resizeCallbacks: ResizeObserverCallback[] = [];

class ResizeObserverStub implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallbacks.push(callback);
  }

  disconnect(): void {
    // noop for tests
  }

  observe(): void {
    // noop
  }

  unobserve(): void {
    // noop
  }
}

describe("Analysis panel layout drift safeguards", () => {
  const originalInnerHeight = window.innerHeight;
  const rafSpy = vi.fn<(cb: FrameRequestCallback) => number>();
  const cafSpy = vi.fn<(handle: number) => void>();

  beforeEach(() => {
    resizeCallbacks.length = 0;
    Object.defineProperty(window, "innerHeight", { value: 640, configurable: true });
    rafSpy.mockImplementation((cb) => {
      cb(0);
      return 1;
    });
    cafSpy.mockImplementation(() => {});
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    vi.stubGlobal("requestAnimationFrame", rafSpy);
    vi.stubGlobal("cancelAnimationFrame", cafSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resizeCallbacks.length = 0;
    Object.defineProperty(window, "innerHeight", { value: originalInnerHeight, configurable: true });
  });

  it("does not emit layout drift when panel height matches available sticky space including padding", async () => {
    const warnSpy = vi.spyOn(logger, "warn");

    const FakeIcon = () => <svg role="presentation" />;
    const tabs: AnalysisTabDescriptor[] = [
      {
        id: "ux-summary",
        label: "UX Summary",
        icon: FakeIcon,
        hasContent: true,
        emptyMessage: "none",
        render: () => <div data-testid="summary-body">Summary content</div>
      }
    ];

    const originalGetComputedStyle = window.getComputedStyle;
    const computedStyleMock = vi
      .spyOn(window, "getComputedStyle")
      .mockImplementation((element: Element): CSSStyleDeclaration => {
        if (element.classList.contains("analysis-panel")) {
          return {
            getPropertyValue: (property: string) => {
              if (property === "max-height") {
                return "495.6px";
              }
              if (property === "padding-top" || property === "padding-bottom") {
                return "20px";
              }
              if (property === "box-sizing") {
                return "content-box";
              }
              return "";
            }
          } as unknown as CSSStyleDeclaration;
        }
        return originalGetComputedStyle.call(window, element);
      });

    render(
      <AnalysisTabsLayout
        tabs={tabs}
        activeTabId="ux-summary"
        onSelectTab={() => {}}
        status="success"
        selectionName="Screenshot_1"
        hasSelection
        initialEmptyMessage="noop"
        progress={undefined}
        isSidebarCollapsed={false}
        hasStatusBanner={false}
        onToggleSidebar={() => {}}
      />
    );

    const grid = document.querySelector(".analysis-grid") as HTMLElement;
    const panel = screen.getByRole("tabpanel", { name: /ux summary/i });

    Object.defineProperty(grid, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        top: 104.4,
        bottom: 704.4,
        left: 0,
        right: 0,
        height: 600,
        width: 600
      })
    });

    Object.defineProperty(panel, "clientHeight", {
      configurable: true,
      get: () => 536
    });

    Object.defineProperty(panel, "scrollHeight", {
      configurable: true,
      get: () => 536
    });

    Object.defineProperty(panel, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        top: 144,
        bottom: window.innerHeight + 40.99,
        left: 0,
        right: 0,
        height: 536,
        width: 600
      })
    });

    // Trigger resize observer callbacks to emulate layout updates
    const fakeObserver = {
      disconnect: () => {},
      observe: () => {},
      unobserve: () => {}
    } as unknown as ResizeObserver;

    resizeCallbacks.forEach((callback) => {
      callback([], fakeObserver);
    });

    await Promise.resolve();

    const layoutWarnings = warnSpy.mock.calls.filter((args) => {
      const [message] = args;
      return typeof message === "string" && message.includes("Analysis panel layout drift detected");
    });

    expect(layoutWarnings).toHaveLength(0);

    const panelContainer = panel.closest(".analysis-panel") as HTMLElement | null;
    expect(panelContainer?.dataset.panelDrift).toBe("aligned");

    computedStyleMock.mockRestore();
  });
});
