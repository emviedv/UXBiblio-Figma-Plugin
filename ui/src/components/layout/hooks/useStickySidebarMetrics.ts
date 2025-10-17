import { useLayoutEffect, useRef, type MutableRefObject, type RefObject } from "react";
import type { AnalysisStatus } from "../../../types/analysis-status";
import { logStickyMetrics } from "../utils/logStickyMetrics";
import {
  calculateStickyMetrics,
  collectStickyObserverTargets,
  shouldMeasureStickyMetrics
} from "../utils/stickySidebarMetricsHelpers";

export type StickySidebarRefs = { gridRef: RefObject<HTMLDivElement>; navigationRef: RefObject<HTMLDivElement>; panelRef: RefObject<HTMLDivElement>; };

export type StickySidebarInputs = { status: AnalysisStatus; hasStatusBanner: boolean; isSidebarCollapsed: boolean; shouldShowInitialEmpty: boolean; hasSelection: boolean; activeTabId: string; tabCount: number; };

export function useStickySidebarMetrics(
  refs: StickySidebarRefs,
  metricsRef: MutableRefObject<{ offset: number; availableHeight: number } | null>,
  inputs: StickySidebarInputs
): void {
  const previousInputsRef = useRef<StickySidebarInputs | null>(null);

  const { status, hasStatusBanner, isSidebarCollapsed, shouldShowInitialEmpty, hasSelection, activeTabId, tabCount } = inputs;

  useLayoutEffect(() => {
    const previousInputs = previousInputsRef.current;
    previousInputsRef.current = { status, hasStatusBanner, isSidebarCollapsed, shouldShowInitialEmpty, hasSelection, activeTabId, tabCount };

    const gridElement = refs.gridRef.current;
    if (!gridElement) return;

    let frameId: number | null = null;

    const updateStickyMetrics = () => {
      const { rect, offsetRounded, availableRounded } = calculateStickyMetrics(gridElement);
      const previousMetrics = metricsRef.current;

      if (
        previousMetrics &&
        previousMetrics.offset === offsetRounded &&
        previousMetrics.availableHeight === availableRounded
      ) {
        return;
      }

      metricsRef.current = {
        offset: offsetRounded,
        availableHeight: availableRounded
      };

      gridElement.style.setProperty("--analysis-sticky-offset", `${offsetRounded}px`);
      gridElement.style.setProperty("--analysis-sticky-available-height", `${availableRounded}px`);

      logStickyMetrics({
        offset: offsetRounded,
        availableHeight: availableRounded,
        rect,
        navigation: refs.navigationRef.current,
        panel: refs.panelRef.current,
        status,
        activeTabId,
        tabCount,
        hasStatusBanner
      });
    };

    const scheduleUpdate = () => {
      if (frameId != null) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        frameId = null;
        updateStickyMetrics();
      });
    };

    if (
      shouldMeasureStickyMetrics(previousInputs, {
        status,
        hasStatusBanner,
        isSidebarCollapsed,
        shouldShowInitialEmpty,
        hasSelection
      })
    ) {
      updateStickyMetrics();
    }

    window.addEventListener("resize", scheduleUpdate);

    const observerTargets = collectStickyObserverTargets(
      gridElement,
      refs.navigationRef.current,
      refs.panelRef.current
    );

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => scheduleUpdate()) : null;
    observerTargets.forEach((target) => resizeObserver?.observe(target));

    return () => {
      window.removeEventListener("resize", scheduleUpdate);
      if (frameId != null) cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
    };
  }, [
    activeTabId,
    hasSelection,
    hasStatusBanner,
    isSidebarCollapsed,
    shouldShowInitialEmpty,
    status,
    tabCount,
    refs.gridRef,
    refs.navigationRef,
    refs.panelRef,
    metricsRef
  ]);
}
