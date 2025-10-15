import { useCallback, useEffect, useMemo, useRef, useLayoutEffect, useId, useState, type JSX } from "react";
import type { LucideIcon } from "lucide-react";
import { Frame, ChevronLeft, ChevronRight } from "lucide-react";
import { logger } from "@shared/utils/logger";
import { classNames } from "../../utils/classNames";
import type { AnalysisTabDescriptor } from "../../types/analysis-tabs";
import type { AnalysisStatus } from "../../types/analysis-status";

type SkeletonStage = "analyzing" | "cancelling";

function buildSkeletonMessage(
  stage: SkeletonStage,
  {
    hasNamedSelection,
    selectionLabel,
    sectionLabel
  }: { hasNamedSelection: boolean; selectionLabel: string; sectionLabel: string }
): string {
  if (stage === "analyzing") {
    const scope = hasNamedSelection ? `${selectionLabel} for ${sectionLabel}` : sectionLabel;
    return `Analyzing ${scope}… Insights will appear here once ready.`;
  }

  if (hasNamedSelection) {
    return `Canceling analysis for ${selectionLabel} (${sectionLabel})…`;
  }

  return `Canceling ${sectionLabel} analysis…`;
}

type PanelStageConfig = {
  panelStage: AnalysisStatus;
  body: JSX.Element | null;
  showSkeleton?: boolean;
  skeletonMessage?: string;
  skeletonLabel?: string;
  progress?: {
    determinate: boolean;
    percent?: number | null;
    minutesLeftLabel?: string | null;
  };
  hasCachedContent: boolean;
  contentState: "active" | "stale" | "void" | "empty" | "initial" | "error" | "live";
};

type StickyEffectInputs = {
  status: AnalysisStatus;
  hasStatusBanner: boolean;
  isSidebarCollapsed: boolean;
  shouldShowInitialEmpty: boolean;
  hasSelection: boolean;
};

function renderPanelStage({
  panelStage,
  body,
  showSkeleton = false,
  skeletonMessage,
  skeletonLabel,
  progress,
  hasCachedContent,
  contentState
}: PanelStageConfig): JSX.Element {
  return (
    <TabPanelStage
      panelStage={panelStage}
      body={body}
      showSkeleton={showSkeleton}
      skeletonMessage={skeletonMessage}
      skeletonLabel={skeletonLabel}
      progress={progress}
      hasCachedContent={hasCachedContent}
      contentState={contentState}
    />
  );
}

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
  progress?: {
    determinate: boolean;
    percent?: number | null;
    minutesLeftLabel?: string | null;
  };
  isSidebarCollapsed: boolean;
  hasStatusBanner: boolean;
  onToggleSidebar: () => void;
  onCopyAnalysis?: () => Promise<boolean> | boolean;
  canCopyAnalysis?: boolean;
}): JSX.Element {
  const isAnalyzing = status === "analyzing";
  const isCancelling = status === "cancelling";
  const isSuccess = status === "success";
  const isError = status === "error";
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
  const stickyEffectInputsRef = useRef<StickyEffectInputs | null>(null);
  const copyFeedbackTimeoutRef = useRef<number | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "success" | "error">("idle");
  const collapseLabel = isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar";
  const tabIdsKey = useMemo(() => tabs.map((tab) => tab.id).join("|"), [tabs]);
  const copyButtonDisabled = !onCopyAnalysis || !canCopyAnalysis;
  const showCopyStatus = copyFeedback !== "idle";
  const copyStatusMessage =
    copyFeedback === "success" ? "Copied analysis JSON." : "Copy failed. Try again.";

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current != null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
        copyFeedbackTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!copyButtonDisabled) {
      return;
    }

    if (copyFeedbackTimeoutRef.current != null) {
      window.clearTimeout(copyFeedbackTimeoutRef.current);
      copyFeedbackTimeoutRef.current = null;
    }

    if (copyFeedback !== "idle") {
      setCopyFeedback("idle");
    }
  }, [copyButtonDisabled, copyFeedback]);

  const handleCopyDebugClick = useCallback(async () => {
    if (copyButtonDisabled || !onCopyAnalysis) {
      return;
    }

    let success = false;
    try {
      const result = await onCopyAnalysis();
      success = result !== false;
    } catch {
      success = false;
    }

    setCopyFeedback(success ? "success" : "error");

    if (copyFeedbackTimeoutRef.current != null) {
      window.clearTimeout(copyFeedbackTimeoutRef.current);
    }

    copyFeedbackTimeoutRef.current = window.setTimeout(() => {
      setCopyFeedback("idle");
      copyFeedbackTimeoutRef.current = null;
    }, 1800);
  }, [copyButtonDisabled, onCopyAnalysis]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const visibleSections = Array.from(
      panel.querySelectorAll<HTMLElement>(".analysis-panel-section:not([hidden])")
    );

    if (visibleSections.length !== 1) {
      logger.warn("[UI] Unexpected analysis panel visibility", {
        status,
        activeTabId,
        visiblePanels: visibleSections.map((section) => section.id),
        tabOrder: tabs.map((tab) => tab.id)
      });
    }
    // When visibility looks correct we stay quiet to limit noise.
  }, [activeTabId, status, tabIdsKey, tabs]);

  useEffect(() => {
    if (status !== "analyzing" && status !== "cancelling") {
      skeletonLogRef.current.clear();
    }
  }, [status]);

  useEffect(() => {
    if (overflowAuditLoggedRef.current) {
      return;
    }

    const navElement = navigationRef.current;
    if (!navElement) {
      return;
    }

    type OverflowSnapshot = {
      tag: string;
      className: string;
      overflowX: string;
      overflowY: string;
      position: string;
    };

    const snapshots: OverflowSnapshot[] = [];
    let current: HTMLElement | null = navElement;

    while (current) {
      const computed = window.getComputedStyle(current);
      snapshots.push({
        tag: current.tagName.toLowerCase(),
        className: current.className ?? "",
        overflowX: computed.overflowX,
        overflowY: computed.overflowY,
        position: computed.position
      });
      current = current.parentElement;
    }

    const blockers = snapshots
      .slice(1) // exclude the navigation element itself
      .filter((snapshot) => snapshot.overflowY !== "visible" && snapshot.overflowY !== "clip");

    if (blockers.length > 0) {
      logger.warn("[UI] Sidebar sticky overflow blockers detected", {
        blockers,
        chain: snapshots
      });
    } else {
      logger.debug("[UI] Sidebar sticky overflow audit", { chain: snapshots });
    }

    overflowAuditLoggedRef.current = true;
  }, [tabs.length, status]);

  useLayoutEffect(() => {
    const previousInputs = stickyEffectInputsRef.current;
    const nextInputs: StickyEffectInputs = {
      status,
      hasStatusBanner,
      isSidebarCollapsed,
      shouldShowInitialEmpty,
      hasSelection
    };
    stickyEffectInputsRef.current = nextInputs;

    const gridElement = gridRef.current;
    if (!gridElement) {
      return;
    }

    let frameId: number | null = null;

    const updateStickyMetrics = () => {
      const rect = gridElement.getBoundingClientRect();
      const offset = Math.max(rect.top, 0);
      const availableHeight = Math.max(window.innerHeight - offset, 0);
      const offsetRounded = Math.round(offset * 100) / 100;
      const availableRounded = Math.round(availableHeight * 100) / 100;
      const previous = stickyMetricsRef.current;

      if (
        !previous ||
        previous.offset !== offsetRounded ||
        previous.availableHeight !== availableRounded
      ) {
        stickyMetricsRef.current = {
          offset: offsetRounded,
          availableHeight: availableRounded
        };

        gridElement.style.setProperty("--analysis-sticky-offset", `${offsetRounded}px`);
        gridElement.style.setProperty(
          "--analysis-sticky-available-height",
          `${availableRounded}px`
        );

        const navElement = navigationRef.current;
        const panelElement = panelRef.current;

        logger.debug("[UI] Sticky sidebar metrics updated", {
          offset: offsetRounded,
          availableHeight: availableRounded,
          gridTop: rect.top,
          gridHeight: rect.height,
          viewportHeight: window.innerHeight,
          navigationClientHeight: navElement?.clientHeight ?? null,
          navigationScrollHeight: navElement?.scrollHeight ?? null,
          panelClientHeight: panelElement?.clientHeight ?? null,
          panelScrollHeight: panelElement?.scrollHeight ?? null
        });
      }
    };

    const scheduleUpdate = () => {
      if (frameId != null) {
        cancelAnimationFrame(frameId);
      }
      frameId = requestAnimationFrame(() => {
        frameId = null;
        updateStickyMetrics();
      });
    };

    const statusRequiresMeasurement = status === "analyzing" || status === "cancelling";
    const previousStatusWasCritical =
      previousInputs?.status === "analyzing" || previousInputs?.status === "cancelling";
    const shouldMeasureImmediately =
      !previousInputs ||
      previousInputs.hasStatusBanner !== hasStatusBanner ||
      previousInputs.isSidebarCollapsed !== isSidebarCollapsed ||
      previousInputs.shouldShowInitialEmpty !== shouldShowInitialEmpty ||
      previousInputs.hasSelection !== hasSelection ||
      statusRequiresMeasurement ||
      previousStatusWasCritical;

    if (shouldMeasureImmediately) {
      updateStickyMetrics();
    }

    window.addEventListener("resize", scheduleUpdate);

    const observerTargets: Element[] = [gridElement];
    const preambleElement = document.querySelector<HTMLElement>(".analysis-shell-preamble");
    if (preambleElement) {
      observerTargets.push(preambleElement);
    }
    const gridBannerElement =
      gridElement.previousElementSibling instanceof HTMLElement
        ? gridElement.previousElementSibling
        : document.querySelector<HTMLElement>(".analysis-grid-banner");
    if (gridBannerElement) {
      observerTargets.push(gridBannerElement);
    }
    const statusBannerElement = document.querySelector<HTMLElement>(".status-banner");
    if (statusBannerElement) {
      observerTargets.push(statusBannerElement);
    }
    if (navigationRef.current) {
      observerTargets.push(navigationRef.current);
    }
    if (panelRef.current) {
      observerTargets.push(panelRef.current);
    }

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            scheduleUpdate();
          })
        : null;

    if (resizeObserver) {
      observerTargets.forEach((target) => resizeObserver.observe(target));
    }

    return () => {
      window.removeEventListener("resize", scheduleUpdate);
      if (frameId != null) {
        cancelAnimationFrame(frameId);
      }
      resizeObserver?.disconnect();
    };
  }, [activeTabId, status, isSidebarCollapsed, shouldShowInitialEmpty, hasSelection, hasStatusBanner]);

  useEffect(() => {
    const panelElement = panelRef.current;
    if (!panelElement) {
      return;
    }

    const signatureParts: Array<string | number | null | boolean> = [];
    const panelClientHeight = Math.round(panelElement.clientHeight * 100) / 100;
    const panelScrollHeight = Math.round(panelElement.scrollHeight * 100) / 100;
    const rect = panelElement.getBoundingClientRect();
    const panelRectHeight = Math.round(rect.height * 100) / 100;
    const panelBottomGap = Math.round(Math.max(0, rect.bottom - window.innerHeight) * 100) / 100;
    const stickyMetrics = stickyMetricsRef.current;

    let maxHeightDeclaration = "none";
    let boxSizing = "unknown";
    let paddingBlock = 0;
    let borderBlock = 0;

    const parseMetric = (value: string | null | undefined): number => {
      if (!value) return 0;
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    try {
      const computed = window.getComputedStyle(panelElement);
      const maxHeightValue = computed.getPropertyValue("max-height").trim();
      if (maxHeightValue) {
        maxHeightDeclaration = maxHeightValue;
      }
      boxSizing =
        computed.getPropertyValue("box-sizing")?.trim() ||
        // @ts-expect-error fallback for older type definitions
        computed.boxSizing ||
        "content-box";
      paddingBlock =
        parseMetric(computed.getPropertyValue("padding-top")) +
        parseMetric(computed.getPropertyValue("padding-bottom"));
      borderBlock =
        parseMetric(computed.getPropertyValue("border-top-width")) +
        parseMetric(computed.getPropertyValue("border-bottom-width"));
    } catch (error) {
      logger.warn("[UI] Failed to read analysis panel style metrics", { error });
    }

    const declaredAvailable = stickyMetrics?.availableHeight ?? null;
    const normalizedDeclared =
      declaredAvailable != null ? Math.round(Math.max(0, declaredAvailable) * 100) / 100 : null;
    const heightMismatch =
      normalizedDeclared != null &&
      panelRectHeight > 0 &&
      Math.abs(panelRectHeight - normalizedDeclared) > 3;
    const overflowExpected = panelScrollHeight > panelClientHeight + 2;
    const driftState = heightMismatch || panelBottomGap > 4 ? "warning" : "aligned";

    panelElement.dataset.panelDrift = driftState;

    signatureParts.push(
      panelClientHeight,
      panelScrollHeight,
      maxHeightDeclaration,
      normalizedDeclared,
      heightMismatch,
      overflowExpected,
      panelBottomGap,
      panelRectHeight,
      boxSizing,
      paddingBlock,
      borderBlock,
      driftState,
      status,
      activeTabId,
      tabIdsKey,
      isSidebarCollapsed,
      shouldShowInitialEmpty,
      hasStatusBanner
    );

    const signature = signatureParts.join("|");
    if (panelMetricsLogRef.current === signature) {
      return;
    }
    panelMetricsLogRef.current = signature;

    logger.debug("[UI] Analysis panel metrics snapshot", {
      clientHeight: panelClientHeight,
      scrollHeight: panelScrollHeight,
      maxHeightDeclaration,
      declaredAvailableHeight: normalizedDeclared,
      heightMismatch,
      overflowExpected,
      rectHeight: panelRectHeight,
      boxSizing,
      paddingBlock,
      borderBlock,
      panelBottomGap,
      status,
      activeTabId,
      tabCount: tabs.length,
      statusBannerVisible: hasStatusBanner
    });

    if (heightMismatch || panelBottomGap > 4) {
      logger.warn("[UI] Analysis panel layout drift detected", {
        clientHeight: panelClientHeight,
        scrollHeight: panelScrollHeight,
        maxHeightDeclaration,
        declaredAvailableHeight: normalizedDeclared,
        panelBottomGap,
        overflowExpected,
        rectHeight: panelRectHeight,
        boxSizing,
        paddingBlock,
        borderBlock,
        status,
        activeTabId,
        statusBannerVisible: hasStatusBanner
      });
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
    hasSelection,
    tabs.length
  ]);

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
    const hasRenderableContent = Boolean(tab.hasContent);
    const allowLiveContentDuringAnalysis = tab.id === "color-palette";
    const tabLabel = tab.label?.trim() ?? "";
    const sectionLabel = tabLabel.length > 0 ? tabLabel : "this section";
    const skeletonLabel = tabLabel || tab.label;
    const cacheKey = tab.id;
    const cachedBody = tabContentCacheRef.current.get(cacheKey) ?? null;
    const skeletonContext = {
      hasNamedSelection: Boolean(selectionName),
      selectionLabel,
      sectionLabel
    };

    let panelStage: AnalysisStatus = status;
    let body: JSX.Element | null = null;
    let showSkeleton = false;
    let skeletonMessage: string | undefined;
    let skeletonLabelValue: string | undefined;
    let stageProgress: PanelStageConfig["progress"];
    let hasCachedContentForStage = false;
    let contentState: PanelStageConfig["contentState"] = "initial";

    const finalizeStage = () =>
      renderPanelStage({
        panelStage,
        body,
        showSkeleton,
        skeletonMessage,
        skeletonLabel: skeletonLabelValue,
        progress: stageProgress,
        hasCachedContent: hasCachedContentForStage,
        contentState
      });

    if (shouldShowInitialEmpty) {
      tabContentCacheRef.current.delete(cacheKey);
      body = <EmptyTabNotice icon={Frame} title="No frame selected" message={initialEmptyMessage} />;
      hasCachedContentForStage = false;
      contentState = "initial";
      return finalizeStage();
    }

    if (isError) {
      tabContentCacheRef.current.delete(cacheKey);
      panelStage = "error";
      body = <EmptyTabNotice message="Analysis unavailable. Try again after resolving the issue." />;
      hasCachedContentForStage = false;
      contentState = "error";
      return finalizeStage();
    }

    if (isAnalyzing) {
      panelStage = "analyzing";
      showSkeleton = true;
      skeletonLabelValue = skeletonLabel;
      const analyzingMessage = buildSkeletonMessage("analyzing", skeletonContext);
      skeletonMessage = analyzingMessage;
      stageProgress = progress;

      if (allowLiveContentDuringAnalysis && hasRenderableContent) {
        const liveBody = tab.render();
        if (liveBody) {
          tabContentCacheRef.current.set(cacheKey, liveBody);
          logger.debug("[UI] Rendering live tab content during analysis", {
            tabId: tab.id,
            tabLabel,
            hasCachedBody: true
          });
          body = liveBody;
          hasCachedContentForStage = true;
          contentState = "live";
          return finalizeStage();
        }
        logger.warn("[UI] Tab render during analysis returned null", {
          tabId: tab.id,
          tabLabel
        });
      } else if (hasRenderableContent && !skeletonLogRef.current.has(tab.id)) {
        skeletonLogRef.current.add(tab.id);
        logger.debug("[UI] Deferring tab render while skeleton active", {
          tabId: tab.id,
          tabLabel
        });
      }

      const skeletonOverlayKey = `overlay:${tab.id}:analyzing`;
      if (!skeletonLogRef.current.has(skeletonOverlayKey)) {
        skeletonLogRef.current.add(skeletonOverlayKey);
        logger.debug("[UI] Showing skeleton overlay during analysis", {
          tabId: tab.id,
          tabLabel,
          hasCachedBody: Boolean(cachedBody)
        });
      }

      body = cachedBody;
      hasCachedContentForStage = Boolean(cachedBody);
      contentState = cachedBody ? "stale" : "void";
      return finalizeStage();
    }

    if (isCancelling) {
      panelStage = "cancelling";
      showSkeleton = true;
      skeletonLabelValue = skeletonLabel;
      const cancellingMessage = buildSkeletonMessage("cancelling", skeletonContext);
      skeletonMessage = cancellingMessage;
      stageProgress = progress;

      const cancellingKey = `${tab.id}-cancelling`;
      if (hasRenderableContent && !skeletonLogRef.current.has(cancellingKey)) {
        skeletonLogRef.current.add(cancellingKey);
        logger.debug("[UI] Holding tab render during cancel", {
          tabId: tab.id,
          tabLabel
        });
      }

      const skeletonCancelOverlayKey = `overlay:${tab.id}:cancelling`;
      if (!skeletonLogRef.current.has(skeletonCancelOverlayKey)) {
        skeletonLogRef.current.add(skeletonCancelOverlayKey);
        logger.debug("[UI] Showing cancellation skeleton overlay", {
          tabId: tab.id,
          tabLabel,
          hasCachedBody: Boolean(cachedBody)
        });
      }

      body = cachedBody;
      hasCachedContentForStage = Boolean(cachedBody);
      contentState = cachedBody ? "stale" : "void";
      return finalizeStage();
    }

    let renderedBody: JSX.Element | null = null;

    if (hasRenderableContent) {
      renderedBody = tab.render();
    }

    if (renderedBody) {
      tabContentCacheRef.current.set(cacheKey, renderedBody);
      body = renderedBody;
      hasCachedContentForStage = true;
      contentState = "active";
      return finalizeStage();
    }

    if (hasRenderableContent) {
      logger.warn("[UI] Tab reported content but render() returned null", {
        tabId: tab.id,
        status
      });
      tabContentCacheRef.current.delete(cacheKey);
      body = <EmptyTabNotice message={tab.emptyMessage} />;
      hasCachedContentForStage = false;
      contentState = "empty";
      return finalizeStage();
    }

    if (isSuccess) {
      tabContentCacheRef.current.delete(cacheKey);
      panelStage = "success";
      body = <EmptyTabNotice message={tab.emptyMessage} />;
      hasCachedContentForStage = false;
      contentState = "empty";
      return finalizeStage();
    }

    tabContentCacheRef.current.delete(cacheKey);
    body = (
      <EmptyTabNotice message={`${selectionLabel} is ready. Run analysis to view insights.`} />
    );
    hasCachedContentForStage = false;
    contentState = "initial";
    return finalizeStage();
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

type TabPanelStageProps = {
  panelStage: AnalysisStatus;
  body: JSX.Element | null;
  showSkeleton: boolean;
  skeletonMessage?: string;
  skeletonLabel?: string;
  progress?: { determinate: boolean; percent?: number | null; minutesLeftLabel?: string | null };
  hasCachedContent: boolean;
  contentState: "active" | "stale" | "void" | "empty" | "initial" | "error" | "live";
};

function TabPanelStage({
  panelStage,
  body,
  showSkeleton,
  skeletonMessage,
  skeletonLabel,
  progress,
  hasCachedContent,
  contentState
}: TabPanelStageProps): JSX.Element {
  return (
    <div
      className="analysis-tab-stage"
      data-panel-stage={panelStage}
      data-panel-has-cache={hasCachedContent ? "true" : undefined}
    >
      {showSkeleton ? (
        <div className="analysis-tab-stage-skeleton" data-skeleton-visible="true">
          <SkeletonTabNotice
            message={skeletonMessage ?? "Analyzing…"}
            progress={progress}
            tabLabel={skeletonLabel}
          />
        </div>
      ) : null}
      <div
        className="analysis-tab-stage-content"
        data-panel-content-state={contentState}
        data-panel-inert={showSkeleton && contentState !== "live" ? "true" : undefined}
        aria-hidden={showSkeleton && contentState !== "live" ? "true" : undefined}
        inert={showSkeleton && contentState !== "live" ? "" : undefined}
      >
        {body}
      </div>
    </div>
  );
}

function EmptyTabNotice({
  message,
  title,
  icon: Icon = Frame
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
  progress,
  tabLabel
}: {
  message: string;
  progress?: { determinate: boolean; percent?: number | null; minutesLeftLabel?: string | null };
  tabLabel?: string;
}): JSX.Element {
  const progressLabelId = useId();
  const hasEta = Boolean(progress?.determinate && progress?.minutesLeftLabel);

  return (
    <div
      className="tab-empty tab-skeleton"
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-skeleton="true"
    >
      <Frame className="tab-empty-icon" aria-hidden="true" />
      {tabLabel ? (
        <p className="tab-empty-title" data-skeleton-tab-label="true">
          {tabLabel}
        </p>
      ) : null}
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
            aria-valuetext={hasEta ? progress?.minutesLeftLabel ?? undefined : undefined}
            aria-describedby={hasEta ? progressLabelId : undefined}
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
        {hasEta ? (
          <div className="global-progress-callout" id={progressLabelId}>
            ETA: {progress?.minutesLeftLabel}
          </div>
        ) : null}
      </div>
      {/* Minimal skeleton blocks for visual rhythm; aria-hidden to avoid duplicate announcement */}
      <div className="skeleton-content" aria-hidden="true">
        <div className="skeleton-line" />
        <div className="skeleton-line" />
        <div className="skeleton-line" />
        <div className="skeleton-line" />
      </div>
    </div>
  );
}
