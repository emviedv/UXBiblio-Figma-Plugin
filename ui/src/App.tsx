import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { logger } from "@shared/utils/logger";
import { stripObservationTokens } from "./utils/strings";
import { formatEndpoint } from "./utils/url";
import type {
  AnalysisResultPayload,
  CreditsSummary,
  PluginToUiMessage
} from "@shared/types/messages";
import type { StructuredAnalysis } from "./utils/analysis";
import { extractAnalysisData, normalizeAnalysis } from "./utils/analysis";
import { StatusBanner } from "./components/StatusBanner";
import { AnalysisTabsLayout } from "./components/layout/AnalysisTabsLayout";
import type { AnalysisTabDescriptor } from "./types/analysis-tabs";
import { buildAnalysisTabs } from "./app/buildAnalysisTabs";
import { HeaderNav, type AppSection } from "./components/HeaderNav";
import { SettingsPage } from "./components/SettingsPage";
import { SearchBar } from "./components/SearchBar";
import type { AnalysisStatus } from "./types/analysis-status";
import {
  createIdleProgressState,
  recordAnalysisDuration,
  type ProgressState
} from "./utils/analysisHistory";
import {
  resetProgressState,
  stopProgressTimer,
  useAnalysisProgressTimer
} from "./hooks/useAnalysisProgress";
import { copyTextToClipboard } from "./utils/clipboard";
// moved: classNames, stripObservationTokens, and endpoint formatting to ui/src/utils

type BannerIntent = "info" | "notice" | "warning" | "danger" | "success";

type AccountStatus = CreditsSummary["accountStatus"];

interface CreditsState extends CreditsSummary {}

interface SelectionState {
  hasSelection: boolean;
  selectionName?: string;
  warnings?: string[];
  analysisEndpoint?: string;
  credits: CreditsState;
}

// moved: analysis types now imported from ui/src/utils/analysis

// moved to ui/src/types/analysis-tabs

const ANALYZE_BUTTON_COPY = "Analyze";
const NO_SELECTION_TOOLTIP = "Please select a Frame or Group before analyzing.";
const TIMEOUT_MESSAGE =
  "Analysis took too long. Try again or simplify your selection.";
const DEFAULT_CREDITS_STATE: CreditsState = {
  totalFreeCredits: 8,
  remainingFreeCredits: 8,
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

interface BannerState {
  intent: BannerIntent;
  message: string;
}

function normalizeCreditsPayload(
  raw: CreditsSummary | undefined,
  fallback: CreditsState
): CreditsState {
  if (!raw) {
    return fallback;
  }

  const total = Number.isFinite(raw.totalFreeCredits)
    ? Math.max(1, Math.floor(raw.totalFreeCredits))
    : fallback.totalFreeCredits;
  const remainingCandidate = Number.isFinite(raw.remainingFreeCredits)
    ? Math.floor(raw.remainingFreeCredits)
    : fallback.remainingFreeCredits;
  const remaining = Math.max(0, Math.min(total, remainingCandidate));
  const accountStatus = normalizeAccountStatusFromPayload(raw.accountStatus, fallback.accountStatus);

  if (
    total === fallback.totalFreeCredits &&
    remaining === fallback.remainingFreeCredits &&
    accountStatus === fallback.accountStatus
  ) {
    return fallback;
  }

  return {
    totalFreeCredits: total,
    remainingFreeCredits: remaining,
    accountStatus
  };
}

function normalizeAccountStatusFromPayload(
  candidate: unknown,
  fallback: AccountStatus
): AccountStatus {
  if (typeof candidate !== "string") {
    return fallback;
  }

  const normalized = candidate.trim().toLowerCase();
  if (normalized === "pro" || normalized === "professional") {
    return "pro";
  }

  if (normalized === "trial" || normalized === "free_trial" || normalized === "free-trial") {
    return "trial";
  }

  if (normalized === "anonymous" || normalized === "free") {
    return "anonymous";
  }

  return fallback;
}

export default function App(): JSX.Element {
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [activeSection, setActiveSection] = useState<AppSection>("analysis");
  const [selectionState, setSelectionState] = useState<SelectionState>({
    hasSelection: false,
    credits: DEFAULT_CREDITS_STATE
  });
  const [analysis, setAnalysis] = useState<AnalysisResultPayload | null>(null);
  const [activeTabId, setActiveTabId] = useState<string>(DEFAULT_TAB_ID);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const selectionStateRef = useRef(selectionState);
  const analysisStartRef = useRef<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const [progress, setProgress] = useState<ProgressState>(() => createIdleProgressState());
  const sanitizedSelectionName = useMemo(() => {
    if (!selectionState.selectionName) {
      return undefined;
    }
    const cleaned = stripObservationTokens(selectionState.selectionName).trim();
    return cleaned.length > 0 ? cleaned : undefined;
  }, [selectionState.selectionName]);
  const creditSummary = selectionState.credits ?? DEFAULT_CREDITS_STATE;
  const hasPaidAccess = creditSummary.accountStatus === "trial" || creditSummary.accountStatus === "pro";
  const freeCreditsRemaining = creditSummary.remainingFreeCredits;
  const creditsExhausted = !hasPaidAccess && freeCreditsRemaining <= 0;
  const bannerCopy = hasPaidAccess
    ? "Signed in · Unlimited analyses unlocked"
    : creditsExhausted
      ? "Free uses exhausted · Sign in to continue"
      : `Free uses · ${freeCreditsRemaining} ${
          freeCreditsRemaining === 1 ? "credit" : "credits"
        } remaining`;
  const bannerCallout = hasPaidAccess
    ? "UXBiblio Pro active"
    : creditsExhausted
      ? "Sign in to continue"
      : "Try 7-day trial free";

  useEffect(() => {
    selectionStateRef.current = selectionState;
  }, [selectionState]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const message = event.data?.pluginMessage as PluginToUiMessage | undefined;
      if (!message) {
        return;
      }

      switch (message.type) {
        case "SELECTION_STATUS": {
          setSelectionState((previous) => ({
            hasSelection: message.payload.hasSelection,
            selectionName: message.payload.selectionName,
            warnings: message.payload.warnings,
            analysisEndpoint: message.payload.analysisEndpoint,
            credits: normalizeCreditsPayload(message.payload.credits, previous.credits)
          }));
          setStatus((previous) => {
            if (!message.payload.hasSelection) {
              return "idle";
            }

            if (previous === "idle" || previous === "error") {
              return "ready";
            }

            return previous;
          });

          setBanner((previous) => {
            if (message.payload.warnings && message.payload.warnings.length > 0) {
              return {
                intent: "warning",
                message: message.payload.warnings.join(" ")
              };
            }

            if (!message.payload.hasSelection) {
              return null;
            }

            if (previous && (previous.intent === "success" || previous.intent === "notice")) {
              return previous;
            }

            return null;
          });
          break;
        }
        case "PING_RESULT": {
          const ok = message.payload.ok;
          const endpoint = message.payload.endpoint;
          const text = ok
            ? `Connection OK: ${formatEndpoint(endpoint)}`
            : `Connection failed: ${message.payload.message || "Unknown error"}`;
          setBanner({ intent: ok ? "success" : "danger", message: text });
          break;
        }
        case "ANALYSIS_IN_PROGRESS": {
          logger.debug("[UI] Analysis marked in progress", {
            selectionName: message.payload.selectionName
          });
          setStatus("analyzing");
          setBanner(null);
          if (analysisStartRef.current == null) {
            analysisStartRef.current = Date.now();
          }
          break;
        }
        case "ANALYSIS_RESULT": {
          logger.debug("[UI] Analysis result received", {
            selectionName: message.payload.selectionName
          });
          setAnalysis(message.payload);
          setStatus("success");
          setBanner(null);
          if (analysisStartRef.current != null) {
            recordAnalysisDuration(Date.now() - analysisStartRef.current);
          }
          analysisStartRef.current = null;
          stopProgressTimer(progressTimerRef);
          resetProgressState(setProgress);
          break;
        }
        case "ANALYSIS_ERROR": {
          const messageText = message.error || TIMEOUT_MESSAGE;
          setStatus("error");
          setBanner({
            intent: "danger",
            message: messageText
          });
          if (analysisStartRef.current != null) {
            // Do not record failed durations aggressively; keep data quality high
            const elapsed = Date.now() - analysisStartRef.current;
            if (elapsed > 5000) recordAnalysisDuration(elapsed);
          }
          analysisStartRef.current = null;
          stopProgressTimer(progressTimerRef);
          resetProgressState(setProgress);
          break;
        }
        case "ANALYSIS_CANCELLED": {
          const selectionName = message.payload.selectionName;
          const hasSelection = selectionStateRef.current?.hasSelection ?? false;
          setStatus(hasSelection ? "ready" : "idle");
          setBanner({
            intent: "notice",
            message: selectionName
              ? `Analysis canceled for “${selectionName}”.`
              : "Analysis canceled."
          });
          // Do not persist cancelled duration; clear progress state
          analysisStartRef.current = null;
          stopProgressTimer(progressTimerRef);
          resetProgressState(setProgress);
          break;
        }
        default:
          break;
      }
    }

    window.addEventListener("message", onMessage);
    parent.postMessage({ pluginMessage: { type: "UI_READY" } }, "*");

    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);

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

  const { structuredAnalysis, missingStructuralData } = useMemo(() => {
    if (!analysis) {
      return {
        structuredAnalysis: DEFAULT_STRUCTURED_ANALYSIS,
        missingStructuralData: false
      };
    }

    const normalized = normalizeAnalysis(extractAnalysisData(analysis.analysis));
    const missing =
      normalized.heuristics.length === 0 &&
      normalized.accessibility.length === 0 &&
      normalized.psychology.length === 0 &&
      normalized.impact.length === 0 &&
      normalized.recommendations.length === 0;

    return { structuredAnalysis: normalized, missingStructuralData: missing };
  }, [analysis]);

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

  const selectionNameForLog = analysis?.selectionName ?? null;
  const handleCopyAnalysisDebug = useCallback(async (): Promise<boolean> => {
    if (!debugCopyPayload) {
      logger.warn("[UI] Copy analysis requested without data", { hasAnalysis: Boolean(analysis) });
      return false;
    }

    const success = await copyTextToClipboard(debugCopyPayload);
    if (success) {
      logger.debug("[UI] Analysis payload copied to clipboard", { selectionName: selectionNameForLog });
    } else {
      logger.warn("[UI] Failed to copy analysis payload to clipboard", { selectionName: selectionNameForLog });
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
  const analyzeDisabled =
    !selectionState.hasSelection || isAnalyzing || isCancelling || creditsExhausted;
  const analyzeDisabledReason = !selectionState.hasSelection
    ? NO_SELECTION_TOOLTIP
    : creditsExhausted
      ? "Sign in or upgrade to continue analyzing."
      : undefined;

  useEffect(() => {
    logger.debug("[UI] Layout state snapshot", {
      status,
      hasSelection: selectionState.hasSelection,
      hasAnalysis: Boolean(analysis),
      isAnalyzing,
      isCancelling,
      freeCreditsRemaining,
      accountStatus: creditSummary.accountStatus,
      creditsExhausted,
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
    creditsExhausted,
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

  // Drive global progress while analyzing
  useAnalysisProgressTimer(status, analysisStartRef, progressTimerRef, setProgress);

  function handleAnalyzeClick() {
    if (!selectionState.hasSelection) {
      setStatus("error");
      setBanner({
        intent: "danger",
        message: NO_SELECTION_TOOLTIP
      });
      return;
    }

    if (creditsExhausted) {
      logger.warn("[UI] Analyze blocked; free credits exhausted", {
        remaining: freeCreditsRemaining,
        accountStatus: creditSummary.accountStatus
      });
      setStatus("error");
      setBanner({
        intent: "warning",
        message: "Sign in or upgrade to continue analyzing with UXBiblio."
      });
      return;
    }

    setStatus("analyzing");
    setBanner(null);
    if (analysisStartRef.current == null) {
      analysisStartRef.current = Date.now();
    }
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
    parent.postMessage({ pluginMessage: { type: "OPEN_AUTH_PORTAL" } }, "*");
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
      {banner ? (
        <header className="app-status-banner" role="banner">
          <StatusBanner
            ref={bannerRef}
            intent={banner.intent}
            message={banner.message}
            hasSelection={selectionState.hasSelection}
          />
        </header>
      ) : null}

      <main className="content" aria-busy={isAnalyzing || isCancelling || undefined}>
        <div className="analysis-shell-preamble" data-section={activeSection}>
          {activeSection === "analysis" ? (
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
            analyzeButtonCopy={ANALYZE_BUTTON_COPY}
            noSelectionTooltip={NO_SELECTION_TOOLTIP}
            disabledReason={analyzeDisabledReason}
          />
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
          />
        ) : (
          <SettingsPage analysisEndpoint={selectionState.analysisEndpoint} onTestConnection={handlePingClick} />
        )}
      </main>

      {/* Connection footer removed per request */}
    </div>
  );
}
