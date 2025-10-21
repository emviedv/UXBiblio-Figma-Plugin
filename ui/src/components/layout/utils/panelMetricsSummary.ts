import type { AnalysisStatus } from "../../../types/analysis-status";
import { readPanelStyleMetrics } from "./readPanelStyleMetrics";

type StickyMetrics = { offset: number; availableHeight: number } | null;

export type PanelMetricsSummary = {
  signature: string;
  driftState: "aligned" | "warning";
  logPayload: Record<string, unknown>;
  warnPayload: Record<string, unknown>;
  timing: {
    totalDurationMs: number;
    styleReadDurationMs: number;
    rectReadDurationMs: number;
  };
};

export function summarizePanelMetrics({
  panelElement,
  stickyMetrics,
  status,
  activeTabId,
  tabIdsKey,
  isSidebarCollapsed,
  shouldShowInitialEmpty,
  hasStatusBanner,
  tabsLength
}: {
  panelElement: HTMLElement;
  stickyMetrics: StickyMetrics;
  status: AnalysisStatus;
  activeTabId: string;
  tabIdsKey: string;
  isSidebarCollapsed: boolean;
  shouldShowInitialEmpty: boolean;
  hasStatusBanner: boolean;
  tabsLength: number;
}): PanelMetricsSummary {
  const now =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? () => performance.now()
      : () => Date.now();

  const measurementStart = now();
  const styleStart = now();
  const styleMetrics = readPanelStyleMetrics(panelElement);
  const styleReadDurationMs = now() - styleStart;
  const panelClientHeight = Math.round(panelElement.clientHeight * 100) / 100;
  const panelScrollHeight = Math.round(panelElement.scrollHeight * 100) / 100;
  const rectStart = now();
  const rect = panelElement.getBoundingClientRect();
  const rectReadDurationMs = now() - rectStart;
  const panelRectHeight = Math.round(rect.height * 100) / 100;
  const panelBottomGap = Math.round(Math.max(0, rect.bottom - window.innerHeight) * 100) / 100;
  const totalDurationMs = now() - measurementStart;

  const declaredAvailable = stickyMetrics?.availableHeight ?? null;
  const normalizedDeclared =
    declaredAvailable != null ? Math.round(Math.max(0, declaredAvailable) * 100) / 100 : null;
  const heightMismatch =
    normalizedDeclared != null &&
    panelRectHeight > 0 &&
    Math.abs(panelRectHeight - normalizedDeclared) > 3;
  const overflowExpected = panelScrollHeight > panelClientHeight + 2;
  const driftState = heightMismatch || panelBottomGap > 4 ? "warning" : "aligned";

  const signatureParts = [
    panelClientHeight,
    panelScrollHeight,
    styleMetrics.maxHeightDeclaration,
    normalizedDeclared,
    heightMismatch,
    overflowExpected,
    panelBottomGap,
    panelRectHeight,
    styleMetrics.boxSizing,
    styleMetrics.paddingBlock,
    styleMetrics.borderBlock,
    driftState,
    status,
    activeTabId,
    tabIdsKey,
    isSidebarCollapsed,
    shouldShowInitialEmpty,
    hasStatusBanner
  ];

  const logPayload = {
    clientHeight: panelClientHeight,
    scrollHeight: panelScrollHeight,
    maxHeightDeclaration: styleMetrics.maxHeightDeclaration,
    declaredAvailableHeight: normalizedDeclared,
    heightMismatch,
    overflowExpected,
    rectHeight: panelRectHeight,
    boxSizing: styleMetrics.boxSizing,
    paddingBlock: styleMetrics.paddingBlock,
    paddingTop: styleMetrics.paddingTop,
    paddingBottom: styleMetrics.paddingBottom,
    borderBlock: styleMetrics.borderBlock,
    panelBottomGap,
    sectionPaddingBlock: styleMetrics.sectionPaddingBlock,
    sectionPaddingInline: styleMetrics.sectionPaddingInline,
    status,
    activeTabId,
    tabCount: tabsLength,
    statusBannerVisible: hasStatusBanner,
    measurementDurationMs: Math.round(totalDurationMs * 100) / 100,
    styleReadDurationMs: Math.round(styleReadDurationMs * 100) / 100,
    rectReadDurationMs: Math.round(rectReadDurationMs * 100) / 100
  };

  const warnPayload = {
    clientHeight: panelClientHeight,
    scrollHeight: panelScrollHeight,
    maxHeightDeclaration: styleMetrics.maxHeightDeclaration,
    declaredAvailableHeight: normalizedDeclared,
    panelBottomGap,
    overflowExpected,
    rectHeight: panelRectHeight,
    boxSizing: styleMetrics.boxSizing,
    paddingBlock: styleMetrics.paddingBlock,
    borderBlock: styleMetrics.borderBlock,
    status,
    activeTabId,
    statusBannerVisible: hasStatusBanner,
    measurementDurationMs: Math.round(totalDurationMs * 100) / 100
  };

  return {
    signature: signatureParts.join("|"),
    driftState,
    logPayload,
    warnPayload,
    timing: {
      totalDurationMs,
      styleReadDurationMs,
      rectReadDurationMs
    }
  };
}
