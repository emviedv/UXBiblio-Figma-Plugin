import { describe, it, expect, beforeAll, afterAll, afterEach, vi, type MockInstance } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Frame } from "lucide-react";
import { AnalysisTabsLayout } from "../../components/layout/AnalysisTabsLayout";
import type { AnalysisTabDescriptor } from "../../types/analysis-tabs";
import { setupAnalysisTabsLayoutTestEnv } from "./setupAnalysisTabsLayoutTestEnv";

describe("AnalysisTabsLayout — contracts", () => {
  let restoreEnv: (() => void) | undefined;

  beforeAll(() => {
    restoreEnv = setupAnalysisTabsLayoutTestEnv();
  });

  afterEach(() => {
    const errorSpy = console.error as unknown as MockInstance;
    const calls = errorSpy?.mock?.calls ?? [];
    const inertWarningsOnly =
      calls.length > 0 &&
      calls.every(
        (args) =>
          typeof args[0] === "string" &&
          args[0].includes("Received `true` for a non-boolean attribute `inert`")
      );

    if (inertWarningsOnly) {
      errorSpy.mockClear();
    }
  });

  afterAll(() => {
    restoreEnv?.();
  });

  function createDescriptor(
    overrides: Partial<AnalysisTabDescriptor> = {}
  ): AnalysisTabDescriptor {
    return {
      id: "ux-summary",
      label: "UX Summary",
      icon: Frame,
      hasContent: true,
      emptyMessage: "No summary.",
      render: vi.fn(() => <div data-testid="summary-pane">Summary body</div>),
      ...overrides
    };
  }

  it("invokes onSelectTab with the tab id and wires aria-controls/expanded contracts", () => {
    const onSelectTab = vi.fn();
    const tabs: AnalysisTabDescriptor[] = [
      createDescriptor(),
      createDescriptor({
        id: "heuristics",
        label: "Heuristics",
        render: vi.fn(() => <div data-testid="heuristics-pane">Heuristic body</div>)
      })
    ];

    render(
      <AnalysisTabsLayout
        tabs={tabs}
        activeTabId="ux-summary"
        onSelectTab={onSelectTab}
        status="success"
        hasSelection={true}
        initialEmptyMessage="Pick a frame."
        isSidebarCollapsed={false}
        hasStatusBanner={false}
        onToggleSidebar={() => undefined}
      />
    );

    const summaryTab = screen.getByRole("tab", { name: "UX Summary" });
    const heuristicsTab = screen.getByRole("tab", { name: "Heuristics" });

    expect(summaryTab.getAttribute("aria-controls")).toBe("analysis-panel-ux-summary");
    expect(summaryTab.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(heuristicsTab);
    expect(onSelectTab).toHaveBeenCalledTimes(1);
    expect(onSelectTab).toHaveBeenCalledWith("heuristics");

    expect(heuristicsTab.getAttribute("aria-controls")).toBe("analysis-panel-heuristics");
    expect(heuristicsTab.getAttribute("aria-expanded")).toBe("false");
  });

  it("clamps deterministically reported progress and exposes ETA callouts for analysis consumers", () => {
    const tabs: AnalysisTabDescriptor[] = [
      createDescriptor({
        id: "ux-summary",
        label: "UX Summary",
        render: vi.fn(() => <div data-testid="summary-live">Summary preview</div>)
      }),
      createDescriptor({
        id: "ux-copywriting",
        label: "UX Copy",
        render: vi.fn(() => <div>Copy</div>)
      })
    ];

    render(
      <AnalysisTabsLayout
        tabs={tabs}
        activeTabId="ux-summary"
        onSelectTab={() => undefined}
        status="analyzing"
        selectionName="Campaign Frame"
        hasSelection={true}
        progress={{ determinate: true, percent: 142.3, minutesLeftLabel: "12 minutes" }}
        initialEmptyMessage="Pick a frame."
        isSidebarCollapsed={false}
        hasStatusBanner={false}
        onToggleSidebar={() => undefined}
      />
    );

    const panel = screen.getByRole("tabpanel", { name: /UX Summary/i });
    const progressbar = within(panel).getByRole("progressbar");
    expect(progressbar.getAttribute("aria-valuenow")).toBe("100");
    expect(progressbar.getAttribute("aria-valuetext")).toBe("12 minutes");

    const fill = progressbar.querySelector(".global-progress-fill");
    expect(fill).not.toBeNull();
    expect(fill?.getAttribute("style")).toContain("width: 100%");

    const callout = within(panel).getByText("ETA: 12 minutes");
    expect(callout.id).toBeTruthy();
    expect(progressbar.getAttribute("aria-describedby")).toBe(callout.id);
  });
});
