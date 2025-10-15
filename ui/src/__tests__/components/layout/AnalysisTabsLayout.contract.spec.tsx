import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, test } from "vitest";
import { AnalysisTabsLayout } from "../../../components/layout/AnalysisTabsLayout";
import type { AnalysisTabDescriptor } from "../../../types/analysis-tabs";

afterEach(() => {
  cleanup();
});

const tab: AnalysisTabDescriptor = {
  id: "insights",
  label: "Insights",
  icon: () => <span />,
  hasContent: false,
  render: () => null,
  emptyMessage: "No insights yet."
};

describe("Contract: progress handshake between App and AnalysisTabsLayout", () => {
  test("renders determinate progress with ETA metadata", () => {
    render(
      <AnalysisTabsLayout
        tabs={[tab]}
        activeTabId="insights"
        status="analyzing"
        onSelectTab={() => undefined}
        hasSelection
        initialEmptyMessage="Select a frame to start."
        isSidebarCollapsed={false}
        hasStatusBanner={false}
        onToggleSidebar={() => undefined}
        progress={{ determinate: true, percent: 64, minutesLeftLabel: "≈1 minute" }}
      />
    );

    const skeleton = screen.getByRole("status", { busy: true });
    expect(skeleton).toBeInTheDocument();

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "64");
    expect(screen.getByText(/ETA: ≈1 minute/i)).toBeVisible();
  });

  test("falls back to indeterminate progress when history unavailable", () => {
    render(
      <AnalysisTabsLayout
        tabs={[tab]}
        activeTabId="insights"
        status="analyzing"
        onSelectTab={() => undefined}
        hasSelection
        initialEmptyMessage="Select a frame to start."
        isSidebarCollapsed={false}
        hasStatusBanner={false}
        onToggleSidebar={() => undefined}
        progress={{ determinate: false }}
      />
    );

    const skeleton = screen.getByRole("status", { busy: true });
    expect(skeleton).toBeInTheDocument();

    const indeterminateBar = skeleton.querySelector(".global-progress-bar.is-indeterminate");
    expect(indeterminateBar).not.toBeNull();
    expect(indeterminateBar).toHaveAttribute("aria-hidden", "true");
  });
});
