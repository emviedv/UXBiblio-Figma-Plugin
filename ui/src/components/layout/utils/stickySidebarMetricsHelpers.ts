import type { AnalysisStatus } from "../../../types/analysis-status";

type StickyInputs = {
  status: AnalysisStatus;
  hasStatusBanner: boolean;
  isSidebarCollapsed: boolean;
  shouldShowInitialEmpty: boolean;
  hasSelection: boolean;
};

export function calculateStickyMetrics(gridElement: HTMLElement): {
  rect: DOMRectReadOnly;
  offsetRounded: number;
  availableRounded: number;
} {
  const rect = gridElement.getBoundingClientRect();
  const offset = Math.max(rect.top, 0);
  const availableHeight = Math.max(window.innerHeight - offset, 0);
  return {
    rect,
    offsetRounded: Math.round(offset * 100) / 100,
    availableRounded: Math.round(availableHeight * 100) / 100
  };
}

export function shouldMeasureStickyMetrics(previous: StickyInputs | null, current: StickyInputs): boolean {
  const statusRequiresMeasurement = current.status === "analyzing" || current.status === "cancelling";
  const previousStatusWasCritical =
    previous?.status === "analyzing" || previous?.status === "cancelling";

  if (!previous) {
    return true;
  }

  if (statusRequiresMeasurement || previousStatusWasCritical) {
    return true;
  }

  return (
    previous.hasStatusBanner !== current.hasStatusBanner ||
    previous.isSidebarCollapsed !== current.isSidebarCollapsed ||
    previous.shouldShowInitialEmpty !== current.shouldShowInitialEmpty ||
    previous.hasSelection !== current.hasSelection
  );
}

export function collectStickyObserverTargets(
  gridElement: HTMLElement,
  navigationElement: HTMLElement | null,
  panelElement: HTMLElement | null
): HTMLElement[] {
  const extras = [
    document.querySelector<HTMLElement>(".analysis-shell-preamble"),
    gridElement.previousElementSibling instanceof HTMLElement
      ? gridElement.previousElementSibling
      : document.querySelector<HTMLElement>(".analysis-grid-banner"),
    document.querySelector<HTMLElement>(".status-banner"),
    navigationElement,
    panelElement
  ].filter((element): element is HTMLElement => element instanceof HTMLElement);

  return [gridElement, ...extras];
}
