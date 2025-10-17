import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Frame } from "lucide-react";
import { vi } from "vitest";
import { AnalysisTabsLayout } from "../../../components/layout/AnalysisTabsLayout";
import type { AnalysisTabDescriptor } from "../../../types/analysis-tabs";

const createTab = (overrides: Partial<AnalysisTabDescriptor> = {}): AnalysisTabDescriptor => ({
  id: "insights",
  label: "Insights",
  icon: Frame,
  hasContent: true,
  render: () => <div data-testid="analysis-body">Rendered body</div>,
  emptyMessage: "No insights yet.",
  ...overrides
});

const renderLayout = (props: Partial<React.ComponentProps<typeof AnalysisTabsLayout>> = {}) => {
  const tabs = props.tabs ?? [createTab()];

  return render(
    <AnalysisTabsLayout
      tabs={tabs}
      activeTabId={props.activeTabId ?? tabs[0]!.id}
      onSelectTab={props.onSelectTab ?? vi.fn()}
      status={props.status ?? "analyzing"}
      selectionName={props.selectionName}
      hasSelection={props.hasSelection ?? true}
      initialEmptyMessage={props.initialEmptyMessage ?? "Select a frame to start."}
      progress={props.progress}
      isSidebarCollapsed={props.isSidebarCollapsed ?? false}
      hasStatusBanner={props.hasStatusBanner ?? false}
      onToggleSidebar={props.onToggleSidebar ?? vi.fn()}
      onCopyAnalysis={props.onCopyAnalysis}
      canCopyAnalysis={props.canCopyAnalysis ?? true}
    />
  );
};

describe("AnalysisTabsLayout skeleton states", () => {
  test.each([
    {
      status: "analyzing" as const,
      expectedMessage: "Analyzing “Homepage” for Insights… Insights will appear here once ready."
    },
    {
      status: "cancelling" as const,
      expectedMessage: "Canceling analysis for “Homepage” (Insights)…"
    }
  ])("announces skeleton for %s", ({ status, expectedMessage }) => {
    renderLayout({
      status,
      selectionName: "Homepage",
      tabs: [createTab({ render: () => <div>Body</div> })],
      progress: { determinate: true, percent: 48, minutesLeftLabel: "≈2 minutes" }
    });

    const skeleton = screen.getByRole("status", { busy: true });
    expect(skeleton).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText(expectedMessage)).toBeVisible();

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "48");
    expect(screen.getByText(/ETA: ≈2 minutes/i)).toBeVisible();
  });
});

test("tablist maintains accessible relationships and selection state", () => {
  const tabs: AnalysisTabDescriptor[] = [
    createTab(),
    createTab({
      id: "palette",
      label: "Color Palette",
      render: () => <div data-testid="palette-body">Palette</div>
    })
  ];

  const onSelectTab = vi.fn();
  renderLayout({ tabs, activeTabId: "insights", onSelectTab, status: "ready" });

  const tabButtons = screen.getAllByRole("tab");
  expect(tabButtons).toHaveLength(2);
  expect(tabButtons[0]).toHaveAttribute("aria-selected", "true");
  expect(tabButtons[1]).toHaveAttribute("aria-selected", "false");
  expect(tabButtons[0]).toHaveAttribute("aria-controls", "analysis-panel-insights");

  fireEvent.click(tabButtons[1]);
  expect(onSelectTab).toHaveBeenCalledWith("palette");
});
