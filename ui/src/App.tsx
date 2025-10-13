import { forwardRef, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type Dispatch, type SetStateAction } from "react";
//
import type { LucideIcon } from "lucide-react";
import { logger } from "@shared/utils/logger";
import { classNames } from "./utils/classNames";
import { stripObservationTokens } from "./utils/strings";
import { formatEndpoint } from "./utils/url";
import type { AnalysisResultPayload, PaletteColor, PluginToUiMessage } from "@shared/types/messages";
import type {
  StructuredAnalysis,
  AnalysisSectionItem,
  AnalysisSource,
  AccessibilityExtras,
  CopywritingContent
} from "./utils/analysis";
import { extractAnalysisData, normalizeAnalysis } from "./utils/analysis";
import { StatusBanner } from "./components/StatusBanner";
import { AnalysisTabsLayout } from "./components/layout/AnalysisTabsLayout";
import { AnalysisControls } from "./components/controls/AnalysisControls";
import type { AnalysisTabDescriptor } from "./types/analysis-tabs";
import { buildAnalysisTabs } from "./app/buildAnalysisTabs";
import { HeaderNav, type AppSection } from "./components/HeaderNav";
import { SettingsPage } from "./components/SettingsPage";
import { SearchBar } from "./components/SearchBar";

// moved: classNames, stripObservationTokens, and endpoint formatting to ui/src/utils

type AnalysisStatus = "idle" | "ready" | "analyzing" | "cancelling" | "success" | "error";
type BannerIntent = "info" | "notice" | "warning" | "danger" | "success";

interface SelectionState {
  hasSelection: boolean;
  selectionName?: string;
  warnings?: string[];
  analysisEndpoint?: string;
}

// moved: analysis types now imported from ui/src/utils/analysis

// moved to ui/src/types/analysis-tabs

const ANALYZE_BUTTON_COPY = "Analyze";
const NO_SELECTION_TOOLTIP = "Please select a Frame or Group before analyzing.";
const TIMEOUT_MESSAGE =
  "Analysis took too long. Try again or simplify your selection.";

const DEFAULT_STRUCTURED_ANALYSIS: StructuredAnalysis = {
  summary: undefined,
  receipts: [],
  copywriting: {
    heading: undefined,
    summary: undefined,
    guidance: [],
    sources: []
  },
  accessibilityExtras: {
    contrastScore: undefined,
    summary: undefined,
    issues: [],
    recommendations: [],
    sources: []
  },
  heuristics: [],
  accessibility: [],
  psychology: [],
  impact: [],
  recommendations: []
};

const SUCCESS_BANNER_DURATION_MS = 4000;
const INITIAL_ANALYSIS_EMPTY_MESSAGE =
  "Choose a Frame, then click Analyze Selection to generate UX, accessibility, and psychology insights in seconds.";
const DEFAULT_TAB_ID = "ux-summary";

interface BannerState {
  intent: BannerIntent;
  message: string;
}

export default function App(): JSX.Element {
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [activeSection, setActiveSection] = useState<AppSection>("analysis");
  const [selectionState, setSelectionState] = useState<SelectionState>({
    hasSelection: false
  });
  const [analysis, setAnalysis] = useState<AnalysisResultPayload | null>(null);
  const [activeTabId, setActiveTabId] = useState<string>(DEFAULT_TAB_ID);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [livePaletteColors, setLivePaletteColors] = useState<PaletteColor[]>([]);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const selectionStateRef = useRef(selectionState);
  const analysisStartRef = useRef<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const [progress, setProgress] = useState<{
    determinate: boolean;
    percent: number | null;
    minutesLeftLabel: string | null;
  }>({ determinate: false, percent: null, minutesLeftLabel: null });
  const sanitizedSelectionName = useMemo(() => {
    if (!selectionState.selectionName) {
      return undefined;
    }
    const cleaned = stripObservationTokens(selectionState.selectionName).trim();
    return cleaned.length > 0 ? cleaned : undefined;
  }, [selectionState.selectionName]);

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
          setSelectionState(message.payload);
          if (!message.payload.hasSelection) {
            setLivePaletteColors([]);
          }
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
          const incomingColors = message.payload.colors ?? [];
          logger.debug("[UI] Analysis in progress colors", {
            count: incomingColors.length,
            preview: incomingColors.slice(0, 5)
          });
          setStatus("analyzing");
          setLivePaletteColors(incomingColors);
          setBanner(null);
          if (analysisStartRef.current == null) {
            analysisStartRef.current = Date.now();
          }
          break;
        }
        case "ANALYSIS_RESULT": {
          const resultColors = message.payload.colors ?? [];
          logger.debug("[UI] Analysis result colors", {
            count: resultColors.length,
            preview: resultColors.slice(0, 5)
          });
          setLivePaletteColors(resultColors);
          setAnalysis(message.payload);
          setStatus("success");
          setBanner(null);
          if (analysisStartRef.current != null) {
            recordAnalysisDuration(Date.now() - analysisStartRef.current);
          }
          analysisStartRef.current = null;
          stopProgressTimer();
          setProgress({ determinate: false, percent: null, minutesLeftLabel: null });
          break;
        }
        case "ANALYSIS_ERROR": {
          const messageText = message.error || TIMEOUT_MESSAGE;
          setStatus("error");
          setLivePaletteColors([]);
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
          stopProgressTimer();
          setProgress({ determinate: false, percent: null, minutesLeftLabel: null });
          break;
        }
        case "ANALYSIS_CANCELLED": {
          const selectionName = message.payload.selectionName;
          const hasSelection = selectionStateRef.current?.hasSelection ?? false;
          setStatus(hasSelection ? "ready" : "idle");
          setLivePaletteColors([]);
          setBanner({
            intent: "notice",
            message: selectionName
              ? `Analysis canceled for “${selectionName}”.`
              : "Analysis canceled."
          });
          // Do not persist cancelled duration; clear progress state
          analysisStartRef.current = null;
          stopProgressTimer();
          setProgress({ determinate: false, percent: null, minutesLeftLabel: null });
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

  const structuredAnalysis = useMemo(() => {
    if (!analysis) {
      return DEFAULT_STRUCTURED_ANALYSIS;
    }

    const normalized = normalizeAnalysis(extractAnalysisData(analysis.analysis));
    const missingStructuralData =
      normalized.heuristics.length === 0 &&
      normalized.accessibility.length === 0 &&
      normalized.psychology.length === 0 &&
      normalized.impact.length === 0 &&
      normalized.recommendations.length === 0;

    if (missingStructuralData) {
      setBanner({
        intent: "warning",
        message:
          "Analysis completed but returned no structured heuristics. Confirm the local proxy and API response format."
      });
    }

    return normalized;
  }, [analysis]);

  const analysisTabs = useMemo<AnalysisTabDescriptor[]>(
    () => buildAnalysisTabs(structuredAnalysis, livePaletteColors),
    [structuredAnalysis, livePaletteColors]
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
        setActiveTabId(preferred);
      }
      return;
    }

    // While analyzing or cancelling, do not auto-bounce the user to another tab.
    if (status === "analyzing" || status === "cancelling") {
      return;
    }

    // Outside of analyzing/cancelling, prefer a tab with content.
    if (!activeTab.hasContent) {
      const fallback =
        analysisTabs.find((tab) => tab.hasContent && tab.id !== activeTab.id)?.id ??
        activeTab.id;
      if (fallback !== activeTabId) {
        setActiveTabId(fallback);
      }
    }
  }, [analysisTabs, activeTabId, status]);

  const isAnalyzing = status === "analyzing";
  const isCancelling = status === "cancelling";
  const analyzeDisabled = !selectionState.hasSelection || isAnalyzing || isCancelling;

  useEffect(() => {
    logger.debug("[UI] Layout state snapshot", {
      status,
      hasSelection: selectionState.hasSelection,
      hasAnalysis: Boolean(analysis),
      isAnalyzing,
      isCancelling,
      analysisTabCount: analysisTabs.length,
      activeTabId
    });
  }, [
    status,
    selectionState.hasSelection,
    analysis,
    isAnalyzing,
    isCancelling,
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
  useProgressTimer(status, analysisStartRef, progressTimerRef, setProgress);

  function handleAnalyzeClick() {
    if (!selectionState.hasSelection) {
      setStatus("error");
      setBanner({
        intent: "danger",
        message: NO_SELECTION_TOOLTIP
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

  const handleUpgradeClick = useCallback(() => {
    parent.postMessage({ pluginMessage: { type: "OPEN_UPGRADE" } }, "*");
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((previous) => {
      const next = !previous;
      logger.debug("[UI] Sidebar collapse toggled", { collapsed: next });
      return next;
    });
  }, []);

  return (
    <div className="app">
      {banner && (
        <StatusBanner
          ref={bannerRef}
          intent={banner.intent}
          message={banner.message}
          hasSelection={selectionState.hasSelection}
        />
      )}

      <main className="content" aria-busy={isAnalyzing || isCancelling || undefined}>
        <header className="header">
          <div className="header-container">
            <HeaderNav active={activeSection} onSelect={setActiveSection} />
          </div>
        </header>
        <SearchBar
          status={status}
          analyzeDisabled={analyzeDisabled}
          hasSelection={selectionState.hasSelection}
          onAnalyze={handleAnalyzeClick}
          analyzeButtonCopy={ANALYZE_BUTTON_COPY}
          noSelectionTooltip={NO_SELECTION_TOOLTIP}
        />
        {activeSection === "analysis" ? (
          <AnalysisTabsLayout
            tabs={analysisTabs}
            activeTabId={activeTabId}
            onSelectTab={setActiveTabId}
            status={status}
            selectionName={selectionState.selectionName}
            hasSelection={selectionState.hasSelection}
            onUpgrade={handleUpgradeClick}
            initialEmptyMessage={INITIAL_ANALYSIS_EMPTY_MESSAGE}
            progress={progress}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={handleToggleSidebar}
            livePaletteColors={livePaletteColors}
          />
        ) : (
          <SettingsPage analysisEndpoint={selectionState.analysisEndpoint} onTestConnection={handlePingClick} />
        )}
      </main>

      {/* Connection footer removed per request */}
    </div>
  );
}

// Progress helpers — lightweight, no external deps
const HISTORY_KEY = "uxbiblio.analysisDurationsMs";

function loadHistory(): number[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed.filter((n) => typeof n === "number") as number[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: number[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-10)));
  } catch {
    // ignore write errors (e.g., storage disabled)
  }
}

function recordAnalysisDuration(ms: number) {
  const history = loadHistory();
  history.push(ms);
  saveHistory(history);
}

function robustEstimateMs(): number | null {
  const history = loadHistory();
  if (history.length === 0) return null;
  // Use median to reduce impact of outliers
  const sorted = [...history].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  // Bound to 20s–8m to avoid unrealistic projections
  return Math.max(20000, Math.min(8 * 60000, Math.round(median)));
}

function formatMinutesLeft(msLeft: number): string {
  if (msLeft <= 0) return "Wrapping up…";
  const minutes = Math.ceil(msLeft / 60000);
  return `About ${minutes} min left`;
}

// Hook progress updates off renders to avoid extra effects; timer control lives in effects below
function computeProgressState(startMs: number | null): {
  determinate: boolean;
  percent: number | null;
  minutesLeftLabel: string | null;
} {
  if (!startMs) return { determinate: false, percent: null, minutesLeftLabel: null };
  const estimate = robustEstimateMs();
  if (!estimate) return { determinate: false, percent: null, minutesLeftLabel: null };
  const now = Date.now();
  const elapsed = Math.max(0, now - startMs);
  const raw = elapsed / estimate;
  const pct = Math.max(4, Math.min(98, Math.round(raw * 100)));
  const left = Math.max(0, estimate - elapsed);
  return { determinate: true, percent: pct, minutesLeftLabel: formatMinutesLeft(left) };
}

// Drive progress updates while analyzing
function useProgressTimer(
  status: AnalysisStatus,
  analysisStartRef: MutableRefObject<number | null>,
  progressTimerRef: MutableRefObject<number | null>,
  setProgress: Dispatch<
    SetStateAction<{ determinate: boolean; percent: number | null; minutesLeftLabel: string | null }>
  >
) {
  useEffect(() => {
    if (status !== "analyzing") {
      if (progressTimerRef.current != null) {
        window.clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      return;
    }

    // Ensure a start timestamp exists
    if (analysisStartRef.current == null) {
      analysisStartRef.current = Date.now();
    }

    // Prime initial value immediately
    setProgress(computeProgressState(analysisStartRef.current));

    // Update once per second; respects reduced motion by not animating width in CSS
    const id = window.setInterval(() => {
      setProgress(computeProgressState(analysisStartRef.current));
    }, 1000);
    progressTimerRef.current = id as unknown as number;

    return () => {
      window.clearInterval(id);
      if (progressTimerRef.current === (id as unknown as number)) {
        progressTimerRef.current = null;
      }
    };
  }, [status]);
}

function stopProgressTimer() {
  try {
    // no-op placeholder for semantic clarity; actual timer cleared in useProgressTimer cleanup
  } catch {
    // ignore
  }
}
