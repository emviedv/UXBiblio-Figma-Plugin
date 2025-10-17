import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { AnalysisTabDescriptor } from "../../types/analysis-tabs";
import { AnalysisTabsLayout } from "../../components/layout/AnalysisTabsLayout";
import { Frame } from "lucide-react";

describe("Analysis skeleton logging noise", () => {
  const resizeObservers: Array<(entries: ResizeObserverEntry[], observer: ResizeObserver) => void> =
    [];

  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: (entries: ResizeObserverEntry[], observer: ResizeObserver) => void) {
          resizeObservers.push(callback);
        }
        disconnect() {}
        observe() {}
        unobserve() {}
      } as unknown as typeof ResizeObserver
    );

    vi.stubGlobal(
      "requestAnimationFrame",
      ((cb: FrameRequestCallback) => {
        cb(0);
        return 1;
      }) as typeof requestAnimationFrame
    );
    vi.stubGlobal("cancelAnimationFrame", (() => {}) as typeof cancelAnimationFrame);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    cleanup();
    resizeObservers.length = 0;
  });

  it("emits skeleton debug log only once per tab while analyzing without cached content", () => {
    const tabs: AnalysisTabDescriptor[] = [
      {
        id: "ux-summary",
        label: "UX Summary",
        icon: Frame,
        hasContent: false,
        emptyMessage: "noop",
        render: () => null
      }
    ];

    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

    const { rerender } = render(
      <AnalysisTabsLayout
        tabs={tabs}
        activeTabId="ux-summary"
        onSelectTab={() => {}}
        status="analyzing"
        selectionName="Screenshot_1"
        hasSelection
        initialEmptyMessage="noop"
        progress={{ determinate: false, percent: null, minutesLeftLabel: null }}
        isSidebarCollapsed={false}
        hasStatusBanner={false}
        onToggleSidebar={() => {}}
      />
    );

    rerender(
      <AnalysisTabsLayout
        tabs={tabs}
        activeTabId="ux-summary"
        onSelectTab={() => {}}
        status="analyzing"
        selectionName="Screenshot_1"
        hasSelection
        initialEmptyMessage="noop"
        progress={{ determinate: false, percent: null, minutesLeftLabel: null }}
        isSidebarCollapsed={false}
        hasStatusBanner={false}
        onToggleSidebar={() => {}}
      />
    );

    const skeletonLogs = debugSpy.mock.calls.filter((call) =>
      call.some(
        (arg) =>
          typeof arg === "string" && arg.includes("[UI] Showing skeleton overlay during analysis")
      )
    );

    expect(skeletonLogs).toHaveLength(1);
  });
});
