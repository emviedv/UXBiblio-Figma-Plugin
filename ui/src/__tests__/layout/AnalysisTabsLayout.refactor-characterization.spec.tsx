import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Frame } from "lucide-react";
import type { AnalysisTabDescriptor } from "../../types/analysis-tabs";
import type { AnalysisStatus } from "../../types/analysis-status";
import { AnalysisTabsLayout } from "../../components/layout/AnalysisTabsLayout";

function buildTab(
  renderImpl: () => JSX.Element | null,
  overrides: Partial<AnalysisTabDescriptor> = {}
): AnalysisTabDescriptor {
  return {
    id: "ux-summary",
    label: "UX Summary",
    icon: Frame,
    hasContent: true,
    emptyMessage: "Summary unavailable.",
    render: renderImpl,
    ...overrides
  };
}

describe("AnalysisTabsLayout refactor characterization", () => {
  it("reuses cached tab body while analyzing and marks content as stale", () => {
    const renderMock = vi.fn(() => <div data-testid="tab-body">Latest summary</div>);
    const tabs = [buildTab(renderMock)];
    const baseProps = {
      tabs,
      activeTabId: "ux-summary",
      onSelectTab: () => undefined,
      selectionName: "Checkout Flow",
      hasSelection: true,
      initialEmptyMessage: "Select a frame to begin.",
      isSidebarCollapsed: false,
      hasStatusBanner: false,
      onToggleSidebar: () => undefined,
      onCopyAnalysis: undefined as (() => boolean) | undefined,
      canCopyAnalysis: false
    };

    const { rerender, container } = render(
      <AnalysisTabsLayout {...baseProps} status="success" progress={undefined} />
    );

    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("tab-body").textContent).toBe("Latest summary");

    renderMock.mockImplementation(() => <div data-testid="tab-body">New summary</div>);

    rerender(
      <AnalysisTabsLayout
        {...baseProps}
        status="analyzing"
        progress={{ determinate: false, percent: null, minutesLeftLabel: null }}
      />
    );

    expect(renderMock).toHaveBeenCalledTimes(1);
    const stageContent = container.querySelector(".analysis-tab-stage-content") as HTMLElement | null;
    expect(stageContent?.dataset.panelContentState).toBe("stale");
    expect(screen.getByTestId("tab-body").textContent).toBe("Latest summary");
  });

  it.each<AnalysisStatus>(["idle", "ready"])(
    "shows the initial empty state when status is %s without a selection",
    (status) => {
      const tabs = [buildTab(() => <div data-testid="tab-body">Hidden</div>, { hasContent: false })];
      const initialEmptyMessage = "Select a frame to start analysis.";

      const { container } = render(
        <AnalysisTabsLayout
          tabs={tabs}
          activeTabId="ux-summary"
          onSelectTab={() => undefined}
          status={status}
          hasSelection={false}
          initialEmptyMessage={initialEmptyMessage}
          isSidebarCollapsed={false}
          hasStatusBanner={false}
          onToggleSidebar={() => undefined}
          canCopyAnalysis={false}
        />
      );

      expect(screen.getByText(initialEmptyMessage)).toBeInTheDocument();
      const stageContent = container.querySelector(".analysis-tab-stage-content") as HTMLElement | null;
      expect(stageContent?.dataset.panelContentState).toBe("initial");
      expect(container.querySelector("[data-skeleton-visible='true']")).toBeNull();
    }
  );

  it("clears copy feedback immediately once the copy control becomes disabled", async () => {
    const onCopyAnalysis = vi.fn().mockResolvedValue(true);
    const tabs = [buildTab(() => <div data-testid="tab-body">Summary body</div>, { hasContent: false })];
    const baseProps = {
      tabs,
      activeTabId: "ux-summary",
      onSelectTab: () => undefined,
      status: "success" as AnalysisStatus,
      hasSelection: true,
      initialEmptyMessage: "Select a frame to begin.",
      isSidebarCollapsed: false,
      hasStatusBanner: false,
      onToggleSidebar: () => undefined,
      progress: undefined
    };

    const { rerender } = render(
      <AnalysisTabsLayout
        {...baseProps}
        selectionName="Checkout Flow"
        onCopyAnalysis={onCopyAnalysis}
        canCopyAnalysis={true}
      />
    );

    const copyButton = screen.getByRole("button", { name: /Copy analysis JSON/i });

    await act(async () => {
      fireEvent.click(copyButton);
      await Promise.resolve();
    });

    expect(await screen.findByText("Copied analysis JSON.")).toBeInTheDocument();

    rerender(
      <AnalysisTabsLayout
        {...baseProps}
        selectionName="Checkout Flow"
        onCopyAnalysis={onCopyAnalysis}
        canCopyAnalysis={false}
      />
    );

    expect(screen.queryByText("Copied analysis JSON.")).toBeNull();
    expect(
      screen.getByRole("button", { name: /Copy analysis JSON/i }).hasAttribute("disabled")
    ).toBe(true);
  });
});
