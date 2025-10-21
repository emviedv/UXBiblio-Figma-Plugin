import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { stripObservationTokens } from "./utils/strings";
import { formatEndpoint } from "./utils/url";
import type { StructuredAnalysis } from "./utils/analysis";
import { buildStructuredAnalysis } from "./app/analysisModel";
import { StatusBanner } from "./components/StatusBanner";
import { AnalysisTabsLayout } from "./components/layout/AnalysisTabsLayout";
import type { AnalysisTabDescriptor } from "./types/analysis-tabs";
import { buildAnalysisTabs } from "./app/buildAnalysisTabs";
import { HeaderNav, type AppSection } from "./components/HeaderNav";
import { SettingsPage } from "./components/SettingsPage";
import { SearchBar } from "./components/SearchBar";
import { copyTextToClipboard } from "./utils/clipboard";
import { isDebugFixActive, type AccountStatus, type CreditsState } from "./app/authBridge";
import { usePluginMessageBridge } from "./hooks/usePluginMessageBridge";
import type { BannerState, SelectionState } from "./app/appState";
import { logger } from "@shared/utils/logger";
import { useAnalysisLifecycle } from "./hooks/useAnalysisLifecycle";
// moved: classNames, stripObservationTokens, and endpoint formatting to ui/src/utils

// moved: analysis types now imported from ui/src/utils/analysis

// moved to ui/src/types/analysis-tabs

const ANALYZE_BUTTON_COPY = "Analyze";
const MAX_FLOW_FRAMES = 5;
const NO_SELECTION_TOOLTIP = "Please select a Frame or Group before analyzing.";
const TIMEOUT_MESSAGE =
  "Analysis took too long. Try again or simplify your selection.";
const DEFAULT_CREDITS_STATE: CreditsState = {
  totalFreeCredits: 0,
  remainingFreeCredits: 0,
  accountStatus: "anonymous"
};

const DEFAULT_STRUCTURED_ANALYSIS: StructuredAnalysis = {
  summary: undefined,
  scopeNote: undefined,
  receipts: [],
  copywriting: {
    heading: undefined,
    summary: undefined,
    guidance: [],
    sources: [],
    sections: []
  },
  accessibilityExtras: {
    contrastScore: undefined,
    contrastStatus: undefined,
    keyRecommendation: undefined,
    summary: undefined,
    issues: [],
    recommendations: [],
    sources: [],
    guardrails: []
  },
  heuristicScorecard: { strengths: [], weaknesses: [], opportunities: [] },
  heuristics: [],
  accessibility: [],
  psychology: [],
  impact: [],
  recommendations: [],
  flows: [],
  industries: [],
  uiElements: [],
  psychologyTags: [],
  suggestedTags: [],
  uxSignals: []
};

const SUCCESS_BANNER_DURATION_MS = 4000;
const INITIAL_ANALYSIS_EMPTY_MESSAGE =
  "Choose a Frame, then click Analyze Selection to generate UX, accessibility, and psychology insights in seconds.";
const DEFAULT_TAB_ID = "ux-summary";


export default function App(): JSX.Element {
  const {
    status,
    analysis,
    progress,
    setIdle: setLifecycleIdle,
    setReady: setLifecycleReady,
    setError: setLifecycleError,
    beginAnalysis,
    completeAnalysis,
    failAnalysis,
    cancelAnalysis
  } = useAnalysisLifecycle();
  const [activeSection, setActiveSection] = useState<AppSection>("analysis");
  const [selectionState, setSelectionState] = useState<SelectionState>({
    hasSelection: false,
    credits: DEFAULT_CREDITS_STATE,
    creditsReported: false,
    authPortalUrl: undefined
  });
  const [manualCopyPayload, setManualCopyPayload] = useState<string | null>(null);
  const [activeTabId, setActiveTabId] = useState<string>(DEFAULT_TAB_ID);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const selectionStateRef = useRef(selectionState);
  const statusRef = useRef(status);
  const pendingAccountStatusRef = useRef<AccountStatus | null>(null);
  const debugFixEnabledRef = useRef<boolean>(isDebugFixActive());
  const sanitizedSelectionName = useMemo(() => {
    if (!selectionState.selectionName) {
      return undefined;
    }
    const cleaned = stripObservationTokens(selectionState.selectionName).trim();
    return cleaned.length > 0 ? cleaned : undefined;
  }, [selectionState.selectionName]);
  const creditSummary = selectionState.credits ?? DEFAULT_CREDITS_STATE;
  const creditsReported = selectionState.credits !== DEFAULT_CREDITS_STATE;
  const hasPaidAccess = creditSummary.accountStatus === "trial" || creditSummary.accountStatus === "pro";
  const freeCreditsRemaining = creditSummary.remainingFreeCredits;
  const creditsBlocked = creditsReported && !hasPaidAccess && freeCreditsRemaining <= 0;
  const bannerCopy = hasPaidAccess
    ? "Signed in · Unlimited analyses unlocked"
    : creditsReported
      ? "No credits remaining · Sign in to continue"
      : "Sign in to unlock unlimited analyses";
  const bannerCallout = hasPaidAccess
    ? "UXBiblio Pro active"
    : creditsReported
      ? "Upgrade for full access"
      : "Upgrade for full access";
  const showAccountBanner = activeSection === "analysis";

  useEffect(() => {
    selectionStateRef.current = selectionState;
  }, [selectionState]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    const currentStatus = selectionState.credits.accountStatus ?? DEFAULT_CREDITS_STATE.accountStatus;
    if (pendingAccountStatusRef.current === currentStatus) {
      logger.debug("[AuthBridge] Pending account status resolved", {
        status: currentStatus
      });
      pendingAccountStatusRef.current = null;
      return;
    }

    if (pendingAccountStatusRef.current) {
      logger.debug("[AuthBridge] Pending account status still awaiting runtime sync", {
        pending: pendingAccountStatusRef.current,
        current: currentStatus
      });
    }
  }, [selectionState.credits.accountStatus]);

  usePluginMessageBridge({
    defaultCreditsState: DEFAULT_CREDITS_STATE,
    timeoutMessage: TIMEOUT_MESSAGE,
    selectionStateRef,
    statusRef,
    pendingAccountStatusRef,
    debugFixEnabledRef,
    setSelectionState,
    setBanner,
    lifecycle: {
      status,
      setIdle: setLifecycleIdle,
      setReady: setLifecycleReady,
      beginAnalysis,
      completeAnalysis,
      failAnalysis,
      cancelAnalysis
    }
  });

  useEffect(() => {
    if (!banner) {
      return;
    }

    if ((banner.intent === "danger" || banner.intent === "warning") && bannerRef.current) {
      bannerRef.current.focus();
    }
  }, [banner]);

  useEffect(() => {
    if (!banner || banner.intent !== "success") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setBanner((current) => {
        if (!current || current.intent !== "success") {
          return current;
        }

        return null;
      });
    }, SUCCESS_BANNER_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [banner]);

  useEffect(() => {
    if (!analysis) {
      return;
    }

    const raw = analysis.analysis;
    const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
    const accessibilityValue = record?.["accessibility"];
    const impactValue = record?.["impact"];
    const recommendationsValue = record?.["recommendations"];

    logger.debug("[UI] Analysis received", {
      selectionName: analysis.selectionName,
      hasAnalysis: Boolean(record),
      keys: record ? Object.keys(record) : null,
      heuristics:
        record && Array.isArray(record["heuristics"])
          ? (record["heuristics"] as unknown[]).length
          : typeof record?.["heuristics"],
      accessibilityKeys:
        accessibilityValue && typeof accessibilityValue === "object"
          ? Object.keys(accessibilityValue as Record<string, unknown>)
          : typeof accessibilityValue,
      impactKeys:
        impactValue && typeof impactValue === "object"
          ? Object.keys(impactValue as Record<string, unknown>)
          : typeof impactValue,
      recommendationsShape:
        recommendationsValue && typeof recommendationsValue === "object"
          ? Object.keys(recommendationsValue as Record<string, unknown>)
          : typeof recommendationsValue
    });
  }, [analysis]);

  const { structured: structuredAnalysis, missingStructuralData } = useMemo(
    () => buildStructuredAnalysis(analysis, DEFAULT_STRUCTURED_ANALYSIS),
    [analysis]
  );

  useEffect(() => {
    if (!analysis || !missingStructuralData) {
      return;
    }

    setBanner((current) => {
      const warningMessage =
        "Analysis completed but returned no structured heuristics. Confirm the local proxy and API response format.";

      if (current?.intent === "warning" && current.message === warningMessage) {
        return current;
      }

      return {
        intent: "warning",
        message: warningMessage
      };
    });
  }, [analysis, missingStructuralData]);

  const debugCopyPayload = useMemo(() => {
    if (!analysis) {
      return null;
    }

    try {
      return JSON.stringify(analysis, null, 2);
    } catch (error) {
      logger.warn("[UI] Failed to serialize analysis payload for debug copy", { error });
      return null;
    }
  }, [analysis]);

  useEffect(() => {
    setManualCopyPayload(null);
  }, [debugCopyPayload]);

  const selectionNameForLog = analysis?.selectionName ?? null;
  const handleCopyAnalysisDebug = useCallback(async (): Promise<boolean> => {
    if (!debugCopyPayload) {
      logger.warn("[UI] Copy analysis requested without data", { hasAnalysis: Boolean(analysis) });
      return false;
    }

    setManualCopyPayload(null);

    const success = await copyTextToClipboard(debugCopyPayload);
    if (success) {
      logger.debug("[UI] Analysis payload copied to clipboard", { selectionName: selectionNameForLog });
    } else {
      logger.warn("[UI] Failed to copy analysis payload to clipboard", { selectionName: selectionNameForLog });
      setManualCopyPayload(debugCopyPayload);
    }
    return success;
  }, [analysis, debugCopyPayload, selectionNameForLog]);

  const canCopyAnalysis = Boolean(debugCopyPayload);

  const analysisTabs = useMemo<AnalysisTabDescriptor[]>(
    () => buildAnalysisTabs(structuredAnalysis),
    [structuredAnalysis]
  );

  useEffect(() => {
    if (analysisTabs.length === 0) {
      if (activeTabId !== DEFAULT_TAB_ID) {
        setActiveTabId(DEFAULT_TAB_ID);
      }
      return;
    }

    const activeTab = analysisTabs.find((tab) => tab.id === activeTabId);
    if (!activeTab) {
      // If current active tab no longer exists, select a reasonable default.
      const preferred =
        analysisTabs.find((tab) => tab.id === DEFAULT_TAB_ID)?.id ??
        analysisTabs.find((tab) => tab.hasContent)?.id ??
        analysisTabs[0].id;
      if (preferred !== activeTabId) {
        logger.debug("[UI] Auto-select fallback tab", {
          reason: "missing",
          fromTabId: activeTabId,
          toTabId: preferred,
          status
        });
        setActiveTabId(preferred);
      }
      return;
    }

    // While analyzing or cancelling, do not auto-bounce the user to another tab.
    if (status === "analyzing" || status === "cancelling") {
      return;
    }

    const shouldForceFallback = status === "idle" || status === "ready" || status === "success";
    if (!activeTab.hasContent && shouldForceFallback) {
      const fallback =
        analysisTabs.find((tab) => tab.hasContent && tab.id !== activeTab.id)?.id ??
        activeTab.id;
      if (fallback !== activeTabId) {
        logger.debug("[UI] Auto-select fallback tab", {
          reason: "no-content",
          fromTabId: activeTab.id,
          toTabId: fallback,
          status
        });
        setActiveTabId(fallback);
      }
    }
  }, [analysisTabs, activeTabId, status]);

  const isAnalyzing = status === "analyzing";
  const isCancelling = status === "cancelling";
  const flowSummary = selectionState.flow;
  const limitExceeded = flowSummary?.limitExceeded ?? false;
  const nonExportableCount = flowSummary?.nonExportableCount ?? 0;
  const insufficientCreditsForFlow = creditsBlocked && Boolean(flowSummary);

  const analyzeDisabled =
    !selectionState.hasSelection ||
    isAnalyzing ||
    isCancelling ||
    creditsBlocked ||
    limitExceeded ||
    insufficientCreditsForFlow;

  const analyzeDisabledReason = (() => {
    if (limitExceeded) {
      return `Select up to ${MAX_FLOW_FRAMES} frames for flow analysis.`;
    }
    if (!selectionState.hasSelection) {
      if (nonExportableCount > 0) {
        return "Some selected layers cannot be analyzed. Choose frames or groups.";
      }
      return NO_SELECTION_TOOLTIP;
    }
    if (creditsBlocked || insufficientCreditsForFlow) {
      return "No credits remaining. Sign in or upgrade to continue analyzing.";
    }
    return undefined;
  })();

  const analyzeButtonCopy =
    flowSummary && flowSummary.frameCount > 1
      ? `Analyze Flow (${flowSummary.frameCount})`
      : ANALYZE_BUTTON_COPY;

  useEffect(() => {
    logger.debug("[UI] Layout state snapshot", {
      status,
      hasSelection: selectionState.hasSelection,
      hasAnalysis: Boolean(analysis),
      isAnalyzing,
      isCancelling,
      freeCreditsRemaining,
      accountStatus: creditSummary.accountStatus,
      creditsBlocked,
      creditsReported,
      flowFrameCount: flowSummary?.frameCount ?? 0,
      flowLimitExceeded: limitExceeded,
      analysisTabCount: analysisTabs.length,
      activeTabId
    });
  }, [
    status,
    selectionState.hasSelection,
    analysis,
      isAnalyzing,
      isCancelling,
      freeCreditsRemaining,
      creditSummary.accountStatus,
      creditsBlocked,
      flowSummary?.frameCount,
      limitExceeded,
      analysisTabs.length,
      activeTabId
    ]);

  useEffect(() => {
    const gridElement = document.querySelector(".analysis-grid");
    logger.debug("[UI] Analysis grid presence", {
      hasGrid: Boolean(gridElement),
      gridChildCount: gridElement ? gridElement.children.length : 0,
      activeTabId,
      status,
      availableTabs: analysisTabs.map((tab) => ({
        id: tab.id,
        hasContent: tab.hasContent
      }))
    });
  }, [analysisTabs, activeTabId, analysis, status]);

  useEffect(() => {
    logger.debug("[UI] Account banner visibility", {
      activeSection,
      accountBannerVisible: showAccountBanner,
      statusBannerVisible: Boolean(banner)
    });
  }, [activeSection, banner, showAccountBanner]);

  function handleAnalyzeClick() {
    if (!selectionState.hasSelection) {
      setLifecycleError();
      setBanner({
        intent: "danger",
        message: NO_SELECTION_TOOLTIP
      });
      return;
    }

    if (creditsBlocked) {
      logger.warn("[UI] Analyze blocked; paid access required", {
        remaining: freeCreditsRemaining,
        accountStatus: creditSummary.accountStatus
      });
      setLifecycleError();
      setBanner({
        intent: "warning",
        message: "No credits remaining. Sign in or upgrade to continue analyzing with UXBiblio."
      });
      return;
    }

    beginAnalysis();
    setBanner(null);
    parent.postMessage({ pluginMessage: { type: "ANALYZE_SELECTION" } }, "*");
  }

  async function handlePingClick() {
    const endpoint = selectionState.analysisEndpoint;
    setBanner({ intent: "notice", message: "Testing connection…" });

    if (endpoint) {
      try {
        const url = new URL(endpoint);
        const healthUrl = `${url.origin}/health`;
        const res = await fetch(healthUrl, { method: "GET" });

        if (res.ok) {
          setBanner({ intent: "success", message: `Connection OK: ${formatEndpoint(healthUrl)}` });
          return;
        }

        setBanner({ intent: "danger", message: `Connection failed (${res.status})` });
        return;
      } catch {
        parent.postMessage({ pluginMessage: { type: "PING_CONNECTION" } }, "*");
        return;
      }
    }

    parent.postMessage({ pluginMessage: { type: "PING_CONNECTION" } }, "*");
  }

  function handleOpenAuthPortal() {
    logger.debug("[UI] Auth CTA clicked");
    logger.debug("[AuthBridge] Delegating auth portal launch to runtime opener");
    parent.postMessage(
      { pluginMessage: { type: "OPEN_AUTH_PORTAL", payload: { openedByUi: false } } },
      "*"
    );
  }

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((previous) => {
      const next = !previous;
      logger.debug("[UI] Sidebar collapse toggled", { collapsed: next });
      return next;
    });
  }, []);

  return (
    <div className="app">
      <main className="content" aria-busy={isAnalyzing || isCancelling || undefined}>
        <div className="analysis-shell-preamble" data-section={activeSection}>
          {showAccountBanner ? (
            <div className="analysis-grid-banner" role="status" aria-live="polite">
              <span className="analysis-grid-banner-copy">{bannerCopy}</span>
              <span className="analysis-grid-banner-callout">{bannerCallout}</span>
            </div>
          ) : null}
          <header className="header">
            <div className="header-container">
              <HeaderNav active={activeSection} onSelect={setActiveSection} />
              <button
                type="button"
                className="header-auth-link"
                onClick={handleOpenAuthPortal}
              >
                Sign In
              </button>
            </div>
          </header>
          <SearchBar
            status={status}
            analyzeDisabled={analyzeDisabled}
            hasSelection={selectionState.hasSelection}
            onAnalyze={handleAnalyzeClick}
            analyzeButtonCopy={analyzeButtonCopy}
            noSelectionTooltip={NO_SELECTION_TOOLTIP}
            disabledReason={analyzeDisabledReason}
          />
          {banner ? (
            <div className="app-status-banner">
              <StatusBanner
                ref={bannerRef}
                intent={banner.intent}
                message={banner.message}
                hasSelection={selectionState.hasSelection}
              />
            </div>
          ) : null}
        </div>
        {activeSection === "analysis" ? (
          <AnalysisTabsLayout
            tabs={analysisTabs}
            activeTabId={activeTabId}
            onSelectTab={setActiveTabId}
            status={status}
            selectionName={sanitizedSelectionName ?? selectionState.selectionName}
            hasSelection={selectionState.hasSelection}
            initialEmptyMessage={INITIAL_ANALYSIS_EMPTY_MESSAGE}
            progress={progress}
            isSidebarCollapsed={isSidebarCollapsed}
            hasStatusBanner={Boolean(banner)}
            onToggleSidebar={handleToggleSidebar}
            onCopyAnalysis={handleCopyAnalysisDebug}
            canCopyAnalysis={canCopyAnalysis}
            manualCopyPayload={manualCopyPayload}
            onDismissManualCopy={() => setManualCopyPayload(null)}
          />
        ) : (
          <SettingsPage analysisEndpoint={selectionState.analysisEndpoint} onTestConnection={handlePingClick} />
        )}
      </main>

      {/* Connection footer removed per request */}
    </div>
  );
}
