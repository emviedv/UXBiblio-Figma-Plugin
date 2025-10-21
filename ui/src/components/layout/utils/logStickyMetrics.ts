import { logger } from "@shared/utils/logger";
import type { AnalysisStatus } from "../../../types/analysis-status";

type StickyMetricsLogInput = {
  offset: number;
  availableHeight: number;
  rect: DOMRectReadOnly;
  navigation: HTMLElement | null;
  panel: HTMLElement | null;
  status: AnalysisStatus;
  activeTabId: string;
  tabCount: number;
  hasStatusBanner: boolean;
  trigger: "effect" | "resize" | "observer";
  measurementDurationMs: number;
};

export function logStickyMetrics({
  offset,
  availableHeight,
  rect,
  navigation,
  panel,
  status,
  activeTabId,
  tabCount,
  hasStatusBanner,
  trigger,
  measurementDurationMs
}: StickyMetricsLogInput): void {
  logger.debug("[UI] Sticky sidebar metrics updated", {
    offset,
    availableHeight,
    gridTop: rect.top,
    gridHeight: rect.height,
    viewportHeight: window.innerHeight,
    navigationClientHeight: navigation?.clientHeight ?? null,
    navigationScrollHeight: navigation?.scrollHeight ?? null,
    panelClientHeight: panel?.clientHeight ?? null,
    panelScrollHeight: panel?.scrollHeight ?? null,
    status,
    activeTabId,
    tabCount,
    statusBannerVisible: hasStatusBanner,
    trigger,
    measurementDurationMs: Math.round(measurementDurationMs * 100) / 100
  });
}
