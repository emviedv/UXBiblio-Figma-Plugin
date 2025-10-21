import { useLayoutEffect, useRef, type MutableRefObject, type RefObject } from "react";
import { logger } from "@shared/utils/logger";
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

    type StickyMetricsTrigger = "effect" | "resize" | "observer";

    const updateStickyMetrics = (trigger: StickyMetricsTrigger) => {
      const measurementStart =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();
      const { rect, offsetRounded, availableRounded } = calculateStickyMetrics(gridElement);
      const previousMetrics = metricsRef.current;
      const measurementEnd =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();
      const measurementDurationMs = measurementEnd - measurementStart;

      if (
        previousMetrics &&
        previousMetrics.offset === offsetRounded &&
        previousMetrics.availableHeight === availableRounded
      ) {
        logger.debug("[UI][Perf] Sticky metrics measurement skipped", {
          trigger,
          measurementDurationMs: Math.round(measurementDurationMs * 100) / 100,
          status,
          activeTabId
        });
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
        hasStatusBanner,
        trigger,
        measurementDurationMs
      });

      if (measurementDurationMs > 12) {
        logger.warn("[UI][Perf] Sticky metrics measurement exceeded threshold", {
          trigger,
          measurementDurationMs: Math.round(measurementDurationMs * 100) / 100,
          status,
          activeTabId,
          tabCount
        });
      }
    };

    const scheduleUpdate = (trigger: StickyMetricsTrigger) => {
      if (frameId != null) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        frameId = null;
        updateStickyMetrics(trigger);
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
      updateStickyMetrics("effect");
    }

    const handleResize = () => scheduleUpdate("resize");
    window.addEventListener("resize", handleResize);

    const observerTargets = collectStickyObserverTargets(
      gridElement,
      refs.navigationRef.current,
      refs.panelRef.current
    );

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => scheduleUpdate("observer"))
        : null;
    observerTargets.forEach((target) => resizeObserver?.observe(target));

    return () => {
      window.removeEventListener("resize", handleResize);
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
