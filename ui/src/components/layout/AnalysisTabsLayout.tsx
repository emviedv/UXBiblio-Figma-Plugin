import { useMemo, useRef, type JSX } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { classNames } from "../../utils/classNames";
import type { AnalysisTabDescriptor } from "../../types/analysis-tabs";
import type { AnalysisStatus } from "../../types/analysis-status";
import {
  EmptyTabNotice,
  TabStageView,
  type SkeletonProgress
} from "./components/AnalysisTabStage";
import { resolveTabStage } from "./utils/resolveTabStage";
import { useAnalysisCopyDebug } from "./hooks/useAnalysisCopyDebug";
import { useStickySidebarMetrics } from "./hooks/useStickySidebarMetrics";
import { useAnalysisPanelDiagnostics } from "./hooks/useAnalysisPanelDiagnostics";

export function AnalysisTabsLayout({
  tabs,
  activeTabId,
  onSelectTab,
  status,
  selectionName,
  hasSelection,
  initialEmptyMessage,
  progress,
  isSidebarCollapsed,
  hasStatusBanner,
  onToggleSidebar,
  onCopyAnalysis,
  canCopyAnalysis = false
}: {
  tabs: AnalysisTabDescriptor[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  status: AnalysisStatus;
  selectionName?: string;
  hasSelection: boolean;
  initialEmptyMessage: string;
  progress?: SkeletonProgress;
  isSidebarCollapsed: boolean;
  hasStatusBanner: boolean;
  onToggleSidebar: () => void;
  onCopyAnalysis?: () => Promise<boolean> | boolean;
  canCopyAnalysis?: boolean;
}): JSX.Element {
  const selectionLabel = selectionName ? `“${selectionName}”` : "This selection";
  const shouldShowInitialEmpty = (status === "idle" || status === "ready") && !hasSelection;
  const gridRef = useRef<HTMLDivElement | null>(null);
  const navigationRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const skeletonLogRef = useRef<Set<string>>(new Set());
  const tabContentCacheRef = useRef<Map<string, JSX.Element | null>>(new Map());
  const stickyMetricsRef = useRef<{ offset: number; availableHeight: number } | null>(null);
  const overflowAuditLoggedRef = useRef(false);
  const panelMetricsLogRef = useRef<string | null>(null);
  const cardOverflowSignatureRef = useRef<string | null>(null);
  const collapseLabel = isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar";
  const tabIdsKey = useMemo(() => tabs.map((tab) => tab.id).join("|"), [tabs]);
  const {
    copyFeedback,
    copyButtonDisabled,
    handleCopyDebugClick,
    showCopyStatus
  } = useAnalysisCopyDebug({
    canCopy: Boolean(canCopyAnalysis),
    onCopy: onCopyAnalysis
  });
  const copyStatusMessage =
    copyFeedback === "success" ? "Copied analysis JSON." : "Copy failed. Try again.";

  useStickySidebarMetrics(
    {
      gridRef,
      navigationRef,
      panelRef
    },
    stickyMetricsRef,
    {
      status,
      hasStatusBanner,
      isSidebarCollapsed,
      shouldShowInitialEmpty,
      hasSelection,
      activeTabId,
      tabCount: tabs.length
    }
  );

  useAnalysisPanelDiagnostics({
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
  });

  if (!tabs.length) {
    return (
      <div
        ref={gridRef}
        className="analysis-grid"
        data-sidebar-collapsed={isSidebarCollapsed ? "true" : undefined}
      >
        <section className="analysis-panel" role="tabpanel" id="analysis-panel">
          <EmptyTabNotice message="No analysis details are available for this run." />
        </section>
      </div>
    );
  }

  function renderTabBody(tab: AnalysisTabDescriptor): JSX.Element {
    const viewModel = resolveTabStage({
      tab,
      status,
      selectionName,
      selectionLabel,
      initialEmptyMessage,
      progress,
      cache: tabContentCacheRef.current,
      skeletonLog: skeletonLogRef.current,
      shouldShowInitialEmpty
    });

    return (
      <TabStageView
        stage={viewModel.stage}
        body={viewModel.body}
        skeleton={viewModel.skeleton}
        contentState={viewModel.contentState}
        hasCachedContent={viewModel.hasCachedContent}
      />
    );
  }

  return (
    <div
      ref={gridRef}
      className="analysis-grid"
      data-sidebar-collapsed={isSidebarCollapsed ? "true" : undefined}
    >
      <nav
        ref={navigationRef}
        className={classNames("analysis-navigation", isSidebarCollapsed && "is-collapsed")}
        aria-label="Analysis sections"
        data-collapsed={isSidebarCollapsed ? "true" : undefined}
      >
        <div className="analysis-navigation-content">
          <ul className="analysis-tablist" role="tablist">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              const tabElementId = `analysis-tab-${tab.id}`;
              const panelId = `analysis-panel-${tab.id}`;
              return (
                <li
                  key={tab.id}
                  className={classNames("analysis-tabitem")}
                >
                  <button
                    type="button"
                    id={tabElementId}
                    className={classNames(
                      "analysis-tab",
                      isActive && "is-active",
                      isSidebarCollapsed && "is-icon-only"
                    )}
                    onClick={() => onSelectTab(tab.id)}
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={panelId}
                    aria-expanded={isActive}
                    tabIndex={isActive ? 0 : -1}
                    data-has-content={
                      tab.hasContent && !shouldShowInitialEmpty ? "true" : "false"
                    }
                    aria-label={tab.label}
                    title={tab.label}
                  >
                    <tab.icon className="analysis-tab-icon" aria-hidden="true" />
                    <span className="analysis-tab-copy">
                      <span className="analysis-tab-label">{tab.label}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="analysis-debug-controls">
            <button
              type="button"
              className="tertiary-button analysis-debug-copy-button"
              onClick={handleCopyDebugClick}
              disabled={copyButtonDisabled}
              title="Copy the latest analysis payload to your clipboard"
            >
              Copy analysis JSON
            </button>
            <p className="analysis-debug-description">
              Copy the latest analysis payload for quick debugging once an analysis completes.
            </p>
            {showCopyStatus ? (
              <span
                className={`analysis-debug-status${copyFeedback === "error" ? " is-error" : ""}`}
                role="status"
                aria-live="polite"
              >
                {copyStatusMessage}
              </span>
            ) : null}
          </div>
          <div className="analysis-collapse-footer">
            <button
              type="button"
              className="analysis-collapse-toggle"
              onClick={onToggleSidebar}
              aria-label={collapseLabel}
              aria-expanded={!isSidebarCollapsed}
              title={collapseLabel}
              data-collapsed={isSidebarCollapsed ? "true" : undefined}
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="analysis-collapse-icon" aria-hidden="true" />
              ) : (
                <ChevronLeft className="analysis-collapse-icon" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </nav>
      <div
        ref={panelRef}
        className="analysis-panel"
        data-layout-stable="true"
        data-collapsed={isSidebarCollapsed ? "true" : undefined}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const panelId = `analysis-panel-${tab.id}`;
          return (
            <section
              key={tab.id}
              className="analysis-panel-section"
              role="tabpanel"
              id={panelId}
              aria-labelledby={`analysis-tab-${tab.id}`}
              aria-live={isActive ? "polite" : undefined}
              hidden={!isActive}
              data-active={isActive ? "true" : "false"}
            >
              {renderTabBody(tab)}
            </section>
          );
        })}
      </div>
    </div>
  );
}
