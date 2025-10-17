import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { render, within } from "@testing-library/react";
import { Frame } from "lucide-react";
import type { AnalysisTabDescriptor } from "../../types/analysis-tabs";
import { AnalysisTabsLayout } from "../../components/layout/AnalysisTabsLayout";
import { setupAnalysisTabsLayoutTestEnv } from "./setupAnalysisTabsLayoutTestEnv";

describe("AnalysisTabsLayout — skeleton progress accessibility", () => {
  let restoreEnv: (() => void) | undefined;

  beforeAll(() => {
    restoreEnv = setupAnalysisTabsLayoutTestEnv();
  });

  afterEach(() => {
    const errorSpy = console.error as unknown as { mock?: { calls: unknown[][] } };
    const inertWarningsOnly =
      (errorSpy?.mock?.calls?.length ?? 0) > 0 &&
      (errorSpy?.mock?.calls ?? []).every(
        (args) =>
          typeof args[0] === "string" &&
          args[0].includes("Received `true` for a non-boolean attribute `inert`")
      );

    if (inertWarningsOnly) {
      errorSpy.mock?.calls?.splice(0);
    }
  });

  afterAll(() => {
    restoreEnv?.();
  });

  function buildTabs(overrides: Partial<AnalysisTabDescriptor> = {}): AnalysisTabDescriptor[] {
    return [
      {
        id: "ux-summary",
        label: "UX Summary",
        icon: Frame,
        hasContent: true,
        emptyMessage: "Summary unavailable.",
        render: () => <div data-testid="summary-body">Summary body</div>,
        ...overrides
      }
    ];
  }

  type Scenario = {
    description: string;
    status: "analyzing" | "cancelling";
    progress: {
      determinate: boolean;
      percent?: number | null;
      minutesLeftLabel?: string | null;
    };
    expectCallout: boolean;
  };

  const scenarios: Scenario[] = [
    {
      description: "determinate progress clamps percent and wires ETA callout",
      status: "analyzing",
      progress: { determinate: true, percent: 112.4, minutesLeftLabel: "6 minutes left" },
      expectCallout: true
    },
    {
      description: "indeterminate progress hides ETA callout and uses hidden track",
      status: "analyzing",
      progress: { determinate: false, percent: null, minutesLeftLabel: null },
      expectCallout: false
    },
    {
      description: "cancelling state retains skeleton semantics while progress continues",
      status: "cancelling",
      progress: { determinate: true, percent: 24.2, minutesLeftLabel: "About 1 minute" },
      expectCallout: true
    }
  ];

  it.each(scenarios)("$description", ({ status, progress, expectCallout }) => {
    const { container } = render(
      <AnalysisTabsLayout
        tabs={buildTabs()}
        activeTabId="ux-summary"
        onSelectTab={() => undefined}
        status={status}
        selectionName="Checkout Flow"
        hasSelection
        initialEmptyMessage="Select a frame to begin."
        progress={progress}
        isSidebarCollapsed={false}
        hasStatusBanner={false}
        onToggleSidebar={() => undefined}
      />
    );

    const skeleton = container.querySelector(".tab-empty.tab-skeleton") as HTMLElement | null;
    expect(skeleton).not.toBeNull();
    expect(skeleton?.getAttribute("role")).toBe("status");
    expect(skeleton?.getAttribute("aria-live")).toBe("polite");
    expect(skeleton?.getAttribute("aria-busy")).toBe("true");
    expect(skeleton?.dataset.skeleton).toBe("true");

    const icon = skeleton?.querySelector(".tab-empty-icon");
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute("aria-hidden")).toBe("true");

    const label = skeleton?.querySelector('[data-skeleton-tab-label="true"]');

    if (status === "analyzing") {
      expect(label?.textContent).toContain("UX Summary");
      expect(skeleton?.textContent ?? "").toContain("Analyzing “Checkout Flow” for UX Summary");
    } else {
      expect(label?.textContent).toContain("UX Summary");
      expect(skeleton?.textContent ?? "").toContain(
        "Canceling analysis for “Checkout Flow” (UX Summary)…"
      );
    }

    const progressRegion = skeleton?.querySelector(".global-progress") as HTMLElement | null;
    expect(progressRegion).not.toBeNull();
    expect(progressRegion?.getAttribute("aria-live")).toBe("polite");

    const determinateBar = progressRegion?.querySelector(
      "[role='progressbar']"
    ) as HTMLElement | null;
    const indeterminateBar = progressRegion?.querySelector(
      ".global-progress-bar.is-indeterminate"
    ) as HTMLElement | null;

    if (progress.determinate) {
      expect(determinateBar).not.toBeNull();
      const bar = determinateBar as HTMLElement;
      const valueNow = bar.getAttribute("aria-valuenow");
      expect(valueNow).toBe(String(Math.max(0, Math.min(100, Math.round(progress.percent ?? 0)))));
      expect(bar.getAttribute("aria-valuemin")).toBe("0");
      expect(bar.getAttribute("aria-valuemax")).toBe("100");

      const fill = bar.querySelector(".global-progress-fill") as HTMLElement | null;
      expect(fill).not.toBeNull();
      expect(fill!.getAttribute("style")).toContain(
        `width: ${Math.max(0, Math.min(100, progress.percent ?? 0))}%`
      );

      if (expectCallout) {
        const callout = progressRegion?.querySelector(".global-progress-callout") as
          | HTMLElement
          | null;
        expect(callout).not.toBeNull();
        expect(callout!.textContent).toContain(progress.minutesLeftLabel ?? "");
        expect(callout!.id).toBeTruthy();
        expect(bar.getAttribute("aria-describedby")).toBe(callout!.id);
        expect(bar.getAttribute("aria-valuetext")).toBe(progress.minutesLeftLabel ?? "");
      } else {
        expect(progressRegion?.querySelector(".global-progress-callout")).toBeNull();
        expect(bar.hasAttribute("aria-describedby")).toBe(false);
        expect(bar.hasAttribute("aria-valuetext")).toBe(false);
      }

      expect(indeterminateBar).toBeNull();
    } else {
      expect(determinateBar).toBeNull();
      expect(indeterminateBar).not.toBeNull();
      expect(indeterminateBar?.getAttribute("aria-hidden")).toBe("true");
      expect(progressRegion?.querySelector(".global-progress-callout")).toBeNull();
    }

    const skeletonContent = skeleton?.querySelector(".skeleton-content");
    expect(skeletonContent).not.toBeNull();
    expect(skeletonContent?.getAttribute("aria-hidden")).toBe("true");
    expect(skeletonContent?.querySelectorAll(".skeleton-line").length).toBeGreaterThanOrEqual(3);
  });
});
