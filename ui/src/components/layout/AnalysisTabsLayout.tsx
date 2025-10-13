import { useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { Frame, ChevronLeft, ChevronRight } from "lucide-react";
import { classNames } from "../../utils/classNames";
import type { AnalysisTabDescriptor } from "../../types/analysis-tabs";

type AnalysisStatus = "idle" | "ready" | "analyzing" | "cancelling" | "success" | "error";

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
  onToggleSidebar
}: {
  tabs: AnalysisTabDescriptor[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  status: AnalysisStatus;
  selectionName?: string;
  hasSelection: boolean;
  initialEmptyMessage: string;
  progress?: {
    determinate: boolean;
    percent?: number | null;
    minutesLeftLabel?: string | null;
  };
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}): JSX.Element {
  const isAnalyzing = status === "analyzing";
  const isCancelling = status === "cancelling";
  const isSuccess = status === "success";
  const isError = status === "error";
  const selectionLabel = selectionName ? `“${selectionName}”` : "This selection";
  const shouldShowInitialEmpty = (status === "idle" || status === "ready") && !hasSelection;
  const navigationRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const collapseLabel = isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar";

  if (!tabs.length) {
    return (
      <div className="analysis-grid" data-sidebar-collapsed={isSidebarCollapsed ? "true" : undefined}>
        <section className="analysis-panel" role="tabpanel" id="analysis-panel">
          <EmptyTabNotice message="No analysis details are available for this run." />
        </section>
      </div>
    );
  }

  function renderTabBody(tab: AnalysisTabDescriptor): JSX.Element {
    if (shouldShowInitialEmpty) {
      return (
        <EmptyTabNotice icon={Frame} title="No frame selected" message={initialEmptyMessage} />
      );
    }

    if (isAnalyzing) {
      const analyzingMessage = selectionName
        ? `Analyzing ${selectionLabel}… Insights will appear here once ready.`
        : "Analyzing selection… Insights will appear here once ready.";
      return <SkeletonTabNotice message={analyzingMessage} progress={progress} />;
    }

    if (isCancelling) {
      return (
        <EmptyTabNotice
          message={
            selectionName ? `Canceling analysis for ${selectionLabel}…` : "Canceling analysis…"
          }
        />
      );
    }

    if (isError) {
      return <EmptyTabNotice message="Analysis unavailable. Try again after resolving the issue." />;
    }

    if (tab.hasContent) {
      const body = tab.render();
      return body ?? <EmptyTabNotice message={tab.emptyMessage} />;
    }

    if (isSuccess) {
      return <EmptyTabNotice message={tab.emptyMessage} />;
    }

    return <EmptyTabNotice message={`${selectionLabel} is ready. Run analysis to view insights.`} />;
  }

  return (
    <div
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
          <div className="analysis-navigation-controls">
            <button
              type="button"
              className="analysis-collapse"
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
              <span className="analysis-collapse-label">{collapseLabel}</span>
            </button>
          </div>
          <ul className="analysis-tablist" role="tablist">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              const tabElementId = `analysis-tab-${tab.id}`;
              const panelId = `analysis-panel-${tab.id}`;
              return (
                <li key={tab.id}>
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

function EmptyTabNotice({
  message,
  title,
  icon: Icon
}: {
  message: string;
  title?: string;
  icon?: LucideIcon;
}): JSX.Element {
  return (
    <div className="tab-empty" role="status" aria-live="polite">
      {Icon ? <Icon className="tab-empty-icon" aria-hidden="true" /> : null}
      {title ? <p className="tab-empty-title">{title}</p> : null}
      <p className="tab-empty-message">{message}</p>
    </div>
  );
}

function SkeletonTabNotice({
  message,
  progress
}: {
  message: string;
  progress?: { determinate: boolean; percent?: number | null; minutesLeftLabel?: string | null };
}): JSX.Element {
  return (
    <div
      className="tab-empty tab-skeleton"
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-skeleton="true"
    >
      <p className="tab-empty-message">{message}</p>
      {/* Global progress indicator visible during analysis */}
      <div className="global-progress" aria-live="polite">
        {progress?.determinate && typeof progress?.percent === "number" ? (
          <div
            className="global-progress-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.max(0, Math.min(100, Math.round(progress.percent)))}
          >
            <div
              className="global-progress-fill"
              style={{ width: `${Math.max(0, Math.min(100, progress.percent ?? 0))}%` }}
            />
          </div>
        ) : (
          <div className="global-progress-bar is-indeterminate" aria-hidden="true">
            <div className="global-progress-fill" />
          </div>
        )}
        {progress?.minutesLeftLabel ? (
          <div className="global-progress-callout">{progress.minutesLeftLabel}</div>
        ) : null}
      </div>
      {/* Minimal skeleton blocks for visual rhythm; aria-hidden to avoid duplicate announcement */}
      <div className="skeleton-content" aria-hidden="true">
        <div className="skeleton-line" />
        <div className="skeleton-line" />
        <div className="skeleton-line" />
      </div>
    </div>
  );
}
