import { describe, it, expect, beforeAll, afterAll, afterEach, vi, type MockInstance } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Frame } from "lucide-react";
import { AnalysisTabsLayout } from "../../components/layout/AnalysisTabsLayout";
import type { AnalysisTabDescriptor } from "../../types/analysis-tabs";
import { setupAnalysisTabsLayoutTestEnv } from "./setupAnalysisTabsLayoutTestEnv";

describe("AnalysisTabsLayout — characterization", () => {
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

  function createTabs(overrides?: Partial<AnalysisTabDescriptor>[]): AnalysisTabDescriptor[] {
    const defaults: AnalysisTabDescriptor[] = [
      {
        id: "ux-summary",
        label: "UX Summary",
        icon: Frame,
        hasContent: true,
        emptyMessage: "No summary available.",
        render: vi.fn(() => <div data-testid="summary-pane">Summary content</div>)
      },
      {
        id: "color-palette",
        label: "Color Palette",
        icon: Frame,
        hasContent: true,
        emptyMessage: "No palette yet.",
        render: vi.fn(() => <div data-testid="palette-pane">Palette content</div>)
      }
    ];

    if (!overrides?.length) {
      return defaults;
    }

    return defaults.map((tab, index) => ({
      ...tab,
      ...(overrides[index] ?? {})
    }));
  }

  it("keeps color palette tab focusable, shows determinate progress, and preserves skeletal a11y semantics during analysis", () => {
    const tabs = createTabs();
    const { container } = render(
      <AnalysisTabsLayout
        tabs={tabs}
        activeTabId="color-palette"
        onSelectTab={() => undefined}
        status="analyzing"
        selectionName="Checkout Flow"
        hasSelection={true}
        initialEmptyMessage="Select a frame to begin."
        progress={{ determinate: true, percent: 64.6, minutesLeftLabel: "2 minutes left" }}
        isSidebarCollapsed={false}
        hasStatusBanner={false}
        onToggleSidebar={() => undefined}
      />
    );

    const tablist = container.querySelector('[role="tablist"]');
    expect(tablist).not.toBeNull();

    const paletteTab = screen.getByRole("tab", { name: "Color Palette" });
    const summaryTab = screen.getByRole("tab", { name: "UX Summary" });

    expect(paletteTab.getAttribute("aria-selected")).toBe("true");
    expect(paletteTab.getAttribute("tabindex")).toBe("0");
    expect(paletteTab.getAttribute("aria-controls")).toBe("analysis-panel-color-palette");
    expect(summaryTab.getAttribute("aria-selected")).toBe("false");
    expect(summaryTab.getAttribute("tabindex")).toBe("-1");

    paletteTab.focus();
    expect(document.activeElement).toBe(paletteTab);
    fireEvent.keyDown(paletteTab, { key: "Escape", code: "Escape" });
    expect(document.activeElement).toBe(paletteTab);

    const panel = screen.getByRole("tabpanel", { name: /Color Palette/i });
    const skeleton = within(panel).getByRole("status", { busy: true });
    expect(skeleton.getAttribute("aria-busy")).toBe("true");
    expect(skeleton.getAttribute("data-skeleton")).toBe("true");
    expect(skeleton.textContent).toMatch(/Analyzing “Checkout Flow” for Color Palette/);

    const progressbar = within(panel).getByRole("progressbar");
    expect(progressbar.getAttribute("aria-valuenow")).toBe("65");
    expect(progressbar.getAttribute("aria-valuemax")).toBe("100");
    expect(progressbar.getAttribute("aria-valuemin")).toBe("0");

    const etaCallout = within(panel).getByText("ETA: 2 minutes left");
    expect(etaCallout.id).toBeTruthy();
    expect(progressbar.getAttribute("aria-describedby")).toBe(etaCallout.id);

    const contentRegion = panel.querySelector(
      '.analysis-tab-stage-content[data-panel-content-state="live"]'
    );
    expect(contentRegion).not.toBeNull();
    expect(contentRegion?.hasAttribute("aria-hidden")).toBe(false);
  });

  it("marks only the active tabpanel as live and toggles hidden attributes when switching tabs", () => {
    const tabs = createTabs([
      {
        render: vi.fn(() => <div data-testid="summary-pane">Summary body</div>)
      },
      {
        render: vi.fn(() => <div data-testid="palette-pane">Palette body</div>)
      }
    ]);

    const { container } = render(
      <AnalysisTabsLayout
        tabs={tabs}
        activeTabId="ux-summary"
        onSelectTab={() => undefined}
        status="success"
        hasSelection={true}
        initialEmptyMessage="Select a frame to begin."
        isSidebarCollapsed={false}
        hasStatusBanner={false}
        onToggleSidebar={() => undefined}
      />
    );

    const activePanel = screen.getByRole("tabpanel", { name: /UX Summary/i });
    const inactivePanel = container.querySelector<HTMLElement>("#analysis-panel-color-palette");

    expect(activePanel.getAttribute("aria-live")).toBe("polite");
    expect(activePanel.hasAttribute("hidden")).toBe(false);
    expect(screen.getByTestId("summary-pane")).toBeTruthy();

    expect(inactivePanel.getAttribute("aria-live")).toBeNull();
    expect(inactivePanel.hasAttribute("hidden")).toBe(true);
    expect(inactivePanel.getAttribute("data-active")).toBe("false");
  });

  it("shows initial empty notice when idle with no selection", () => {
    const tabs = createTabs().map((tab) => ({
      ...tab,
      hasContent: false
    }));

    render(
      <AnalysisTabsLayout
        tabs={tabs}
        activeTabId="ux-summary"
        onSelectTab={() => undefined}
        status="idle"
        hasSelection={false}
        initialEmptyMessage="Select a frame to begin."
        isSidebarCollapsed={false}
        hasStatusBanner={false}
        onToggleSidebar={() => undefined}
      />
    );

    const notice = screen.getAllByRole("status")[0];
    expect(notice).toBeTruthy();
    expect(within(notice).getByText("No frame selected")).toBeTruthy();
    expect(notice.querySelector(".tab-empty-icon")).not.toBeNull();
    expect(notice.hasAttribute("aria-busy")).toBe(false);
  });
});
