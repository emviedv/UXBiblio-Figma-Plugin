import { useEffect, type MutableRefObject, type RefObject } from "react";
import { logger } from "@shared/utils/logger";
import type { AnalysisStatus } from "../../../types/analysis-status";
import type { AnalysisTabDescriptor } from "../../../types/analysis-tabs";
import type { SkeletonProgress } from "../components/AnalysisTabStage";
import { auditPanelVisibility } from "../utils/auditPanelVisibility";
import { auditStickyOverflow } from "../utils/auditStickyOverflow";
import { summarizePanelMetrics } from "../utils/panelMetricsSummary";
import { isDebugFixEnabled } from "@shared/utils/debugFlags";
import { logCardOverflowDiagnostics } from "../utils/logCardOverflowDiagnostics";

type StickyMetrics = { offset: number; availableHeight: number } | null;
export type AnalysisPanelDiagnosticsParams = {
  status: AnalysisStatus;
  activeTabId: string;
  tabs: AnalysisTabDescriptor[];
  tabIdsKey: string;
  navigationRef: RefObject<HTMLDivElement>;
  panelRef: RefObject<HTMLDivElement>;
  stickyMetricsRef: MutableRefObject<StickyMetrics>;
  skeletonLogRef: MutableRefObject<Set<string>>;
  overflowAuditLoggedRef: MutableRefObject<boolean>;
  panelMetricsLogRef: MutableRefObject<string | null>;
  cardOverflowSignatureRef: MutableRefObject<string | null>;
  shouldShowInitialEmpty: boolean;
  hasStatusBanner: boolean;
  isSidebarCollapsed: boolean;
  selectionName?: string;
  progress?: SkeletonProgress;
};

export function useAnalysisPanelDiagnostics({
  status,
  activeTabId,
  tabs,
  tabIdsKey,
  navigationRef,
  panelRef,
  stickyMetricsRef,
  skeletonLogRef,
  overflowAuditLoggedRef,
  panelMetricsLogRef,
  cardOverflowSignatureRef,
  shouldShowInitialEmpty,
  hasStatusBanner,
  isSidebarCollapsed,
  selectionName,
  progress
}: AnalysisPanelDiagnosticsParams): void {
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    auditPanelVisibility({ panelElement: panel, status, activeTabId, tabs });
  }, [activeTabId, status, tabIdsKey, tabs, panelRef]);

  useEffect(() => {
    if (status !== "analyzing" && status !== "cancelling") skeletonLogRef.current.clear();
  }, [status, skeletonLogRef]);

  useEffect(() => {
    if (overflowAuditLoggedRef.current) return;
    const navElement = navigationRef.current;
    if (!navElement) return;
    auditStickyOverflow({ navigationElement: navElement, overflowAuditLoggedRef });
  }, [navigationRef, overflowAuditLoggedRef, status, tabs.length]);

  useEffect(() => {
    const panelElement = panelRef.current;
    if (!panelElement) return;
    void progress;
    void selectionName;

    const summary = summarizePanelMetrics({
      panelElement,
      stickyMetrics: stickyMetricsRef.current,
      status,
      activeTabId,
      tabIdsKey,
      isSidebarCollapsed,
      shouldShowInitialEmpty,
      hasStatusBanner,
      tabsLength: tabs.length
    });

    panelElement.dataset.panelDrift = summary.driftState;
    if (panelMetricsLogRef.current === summary.signature) return;
    panelMetricsLogRef.current = summary.signature;

    logger.debug("[UI] Analysis panel metrics snapshot", summary.logPayload);

    if (summary.driftState === "warning") {
      logger.warn("[UI] Analysis panel layout drift detected", summary.warnPayload);
    }
  }, [
    activeTabId,
    status,
    tabIdsKey,
    isSidebarCollapsed,
    shouldShowInitialEmpty,
    hasStatusBanner,
    progress?.percent,
    progress?.minutesLeftLabel,
    selectionName,
    tabs,
    panelRef,
    panelMetricsLogRef,
    stickyMetricsRef,
    progress
  ]);

  useEffect(() => {
    if (!isDebugFixEnabled()) return;
    const panelElement = panelRef.current;
    if (!panelElement) return;

    cardOverflowSignatureRef.current = logCardOverflowDiagnostics({
      panelElement,
      activeTabId,
      status,
      tabIdsKey,
      previousSignature: cardOverflowSignatureRef.current ?? undefined
    });
  }, [activeTabId, status, tabIdsKey, panelRef, cardOverflowSignatureRef]);
}
