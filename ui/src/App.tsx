import { forwardRef, useCallback, useEffect, useMemo, useRef, useState, useId } from "react";
import type { ReactNode, SVGProps } from "react";
import {
  Accessibility,
  Brain,
  Eye,
  Frame,
  Lightbulb,
  ListChecks,
  Palette,
  Target,
  Type
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { logger } from "@shared/utils/logger";
import type {
  AnalysisResultPayload,
  PaletteColor,
  PluginToUiMessage
} from "@shared/types/messages";

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

const OBS_TOKEN_PATTERN = /\bOBS-\d+\b/i;

function stripObservationTokens(text: string): string {
  if (!OBS_TOKEN_PATTERN.test(text)) {
    return text;
  }

  const sanitizedLines = text
    .split("\n")
    .map((line) => sanitizeObservationLine(line))
    .filter((line) => line.length > 0);

  return sanitizedLines.join("\n").trim();
}

function sanitizeObservationLine(line: string): string {
  if (!line) {
    return "";
  }

  let output = line.replace(/\(\s*OBS-\d+\s*\)/gi, "");
  output = output.replace(/\bOBS-\d+\b/gi, "");
  output = output.replace(/,\s*,/g, ", ");
  output = output.replace(/,\s*(?=[\])])/g, "");
  output = output.replace(/[ \t]{2,}/g, " ");
  output = output.replace(/\s+([,.;:])/g, "$1");
  output = output.replace(/^[,;:\s-]+/, "");
  output = output.replace(/[,;:\s-]+$/, "");
  return output.trim();
}

type AnalysisStatus = "idle" | "ready" | "analyzing" | "cancelling" | "success" | "error";
type BannerIntent = "info" | "notice" | "warning" | "danger" | "success";

interface SelectionState {
  hasSelection: boolean;
  selectionName?: string;
  warnings?: string[];
  analysisEndpoint?: string;
}

interface StructuredAnalysis {
  summary?: string;
  receipts: AnalysisSource[];
  copywriting: CopywritingContent;
  accessibilityExtras: AccessibilityExtras;
  heuristics: AnalysisSectionItem[];
  accessibility: AnalysisSectionItem[];
  psychology: AnalysisSectionItem[];
  impact: AnalysisSectionItem[];
  recommendations: string[];
}

interface AnalysisSectionItem {
  title: string;
  description?: string;
  severity?: string;
}

interface AnalysisSource {
  title: string;
  url?: string;
  domainTier?: string;
  publishedYear?: number;
  usedFor?: string;
}

interface AccessibilityExtras {
  contrastScore?: number;
  summary?: string;
  issues: string[];
  recommendations: string[];
  sources: AnalysisSource[];
}

interface CopywritingContent {
  heading?: string;
  summary?: string;
  guidance: string[];
  sources: AnalysisSource[];
}

interface AnalysisTabDescriptor {
  id: string;
  label: string;
  icon: LucideIcon;
  hasContent: boolean;
  render: () => JSX.Element | null;
  emptyMessage: string;
}

const ANALYZE_BUTTON_COPY = "Analyze Selection";
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

const MAX_PALETTE_COLORS = 5;
const COPY_FEEDBACK_DURATION = 2000;
const SUCCESS_BANNER_DURATION_MS = 4000;
const INITIAL_ANALYSIS_EMPTY_MESSAGE =
  "Choose a Frame, then click Analyze Selection to generate UX, accessibility, and psychology insights in seconds.";

interface BannerState {
  intent: BannerIntent;
  message: string;
}

export default function App(): JSX.Element {
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [selectionState, setSelectionState] = useState<SelectionState>({
    hasSelection: false
  });
  const [analysis, setAnalysis] = useState<AnalysisResultPayload | null>(null);
  const [colors, setColors] = useState<PaletteColor[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("color-palette");
  const [banner, setBanner] = useState<BannerState | null>(null);
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const selectionStateRef = useRef(selectionState);
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
          setColors(incomingColors);
          setStatus("analyzing");
          setBanner(null);
          break;
        }
        case "ANALYSIS_RESULT": {
          const resultColors = message.payload.colors ?? [];
          logger.debug("[UI] Analysis result colors", {
            count: resultColors.length,
            preview: resultColors.slice(0, 5)
          });
          setAnalysis(message.payload);
          setColors(resultColors);
          setStatus("success");
          setBanner(null);
          break;
        }
        case "ANALYSIS_ERROR": {
          const messageText = message.error || TIMEOUT_MESSAGE;
          setStatus("error");
          setBanner({
            intent: "danger",
            message: messageText
          });
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

  const analysisTabs = useMemo<AnalysisTabDescriptor[]>(() => {
    const summary = structuredAnalysis.summary;
    const copywriting = structuredAnalysis.copywriting;
    const accessibilityExtras = structuredAnalysis.accessibilityExtras;

    const hasSummaryContent =
      typeof summary === "string" && summary.trim().length > 0
        ? true
        : structuredAnalysis.receipts.length > 0;

    const hasCopywritingSummary =
      typeof copywriting.summary === "string" && copywriting.summary.trim().length > 0;
    const hasCopywritingContent =
      hasCopywritingSummary ||
      copywriting.guidance.length > 0 ||
      copywriting.sources.length > 0;

    const hasAccessibilitySummary =
      typeof accessibilityExtras.summary === "string" &&
      accessibilityExtras.summary.trim().length > 0;
    const hasAccessibilityContent =
      structuredAnalysis.accessibility.length > 0 ||
      typeof accessibilityExtras.contrastScore === "number" ||
      hasAccessibilitySummary ||
      accessibilityExtras.issues.length > 0 ||
      accessibilityExtras.recommendations.length > 0 ||
      accessibilityExtras.sources.length > 0;

    const hasHeuristicsContent = structuredAnalysis.heuristics.length > 0;
    const hasPsychologyContent = structuredAnalysis.psychology.length > 0;
    const hasImpactContent = structuredAnalysis.impact.length > 0;
    const hasRecommendationsContent = structuredAnalysis.recommendations.length > 0;
    const hasPaletteContent = colors.length > 0;

    return [
      {
        id: "color-palette",
        label: "Color Palette",
        icon: Palette,
        hasContent: hasPaletteContent,
        emptyMessage: "No color palette captured for this analysis.",
        render: () => (hasPaletteContent ? <ColorPalette colors={colors} /> : null)
      },
      {
        id: "ux-summary",
        label: "UX Summary",
        icon: Eye,
        hasContent: hasSummaryContent,
        emptyMessage: "No UX summary available for this selection.",
        render: () =>
          hasSummaryContent ? (
            <SummaryCard
              summary={structuredAnalysis.summary}
              receipts={structuredAnalysis.receipts}
            />
          ) : null
      },
      {
        id: "ux-copywriting",
        label: "UX Copy",
        icon: Type,
        hasContent: hasCopywritingContent,
        emptyMessage: "No UX copy guidance available for this selection.",
        render: () =>
          hasCopywritingContent ? (
            <CopywritingCard copywriting={structuredAnalysis.copywriting} />
          ) : null
      },
      {
        id: "accessibility",
        label: "Accessibility",
        icon: Accessibility,
        hasContent: hasAccessibilityContent,
        emptyMessage: "No accessibility insights surfaced for this analysis.",
        render: () =>
          hasAccessibilityContent ? (
            <AccessibilityAccordion
              items={structuredAnalysis.accessibility}
              extras={structuredAnalysis.accessibilityExtras}
              icon={Accessibility}
            />
          ) : null
      },
      {
        id: "heuristics",
        label: "Heuristics",
        icon: ListChecks,
        hasContent: hasHeuristicsContent,
        emptyMessage: "No heuristics surfaced for this analysis.",
        render: () =>
          hasHeuristicsContent ? (
            <AccordionSection
              title="Heuristics"
              items={structuredAnalysis.heuristics}
              icon={ListChecks}
            />
          ) : null
      },
      {
        id: "psychology",
        label: "Psychology",
        icon: Brain,
        hasContent: hasPsychologyContent,
        emptyMessage: "No psychology insights captured for this analysis.",
        render: () =>
          hasPsychologyContent ? (
            <AccordionSection title="Psychology" items={structuredAnalysis.psychology} icon={Brain} />
          ) : null
      },
      {
        id: "impact",
        label: "Impact",
        icon: Target,
        hasContent: hasImpactContent,
        emptyMessage: "No impact insights captured for this analysis.",
        render: () =>
          hasImpactContent ? (
            <AccordionSection title="Impact" items={structuredAnalysis.impact} icon={Target} />
          ) : null
      },
      {
        id: "recommendations",
        label: "Next Steps",
        icon: Lightbulb,
        hasContent: hasRecommendationsContent,
        emptyMessage: "No next steps provided for this selection.",
        render: () =>
          hasRecommendationsContent ? (
            <RecommendationsAccordion
              recommendations={structuredAnalysis.recommendations}
              icon={Lightbulb}
            />
          ) : null
      }
    ];
  }, [colors, structuredAnalysis]);

  useEffect(() => {
    if (analysisTabs.length === 0) {
      if (activeTabId !== "color-palette") {
        setActiveTabId("color-palette");
      }
      return;
    }

    const activeTab = analysisTabs.find((tab) => tab.id === activeTabId);
    if (!activeTab) {
      const preferred =
        analysisTabs.find((tab) => tab.id === "color-palette" && tab.hasContent)?.id ??
        analysisTabs.find((tab) => tab.hasContent)?.id ??
        analysisTabs[0].id;
      if (preferred !== activeTabId) {
        setActiveTabId(preferred);
      }
      return;
    }

    if (!activeTab.hasContent) {
      const fallback =
        analysisTabs.find((tab) => tab.hasContent && tab.id !== activeTab.id)?.id ??
        activeTab.id;
      if (fallback !== activeTabId) {
        setActiveTabId(fallback);
      }
    }
  }, [analysisTabs, activeTabId]);

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
      paletteColorCount: colors.length,
      analysisTabCount: analysisTabs.length,
      activeTabId
    });
  }, [
    status,
    selectionState.hasSelection,
    analysis,
    isAnalyzing,
    isCancelling,
    colors.length,
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
    parent.postMessage({ pluginMessage: { type: "ANALYZE_SELECTION" } }, "*");
  }

  function handleCancelClick() {
    if (status !== "analyzing") {
      return;
    }

    const selectionLabel = selectionState.selectionName
      ? ` “${selectionState.selectionName}”`
      : "";

    setStatus("cancelling");
    setBanner({
      intent: "notice",
      message: `Canceling analysis${selectionLabel}…`
    });
    parent.postMessage({ pluginMessage: { type: "CANCEL_ANALYSIS" } }, "*");
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
        <AnalysisLoader status={status} selectionName={sanitizedSelectionName} />
        <header className="header">
          <div className="header-container">
            <AnalysisControls
              status={status}
              analyzeDisabled={analyzeDisabled}
              hasSelection={selectionState.hasSelection}
              onAnalyze={handleAnalyzeClick}
              onCancel={handleCancelClick}
            />
          </div>
        </header>
        <AnalysisTabsLayout
          tabs={analysisTabs}
          activeTabId={activeTabId}
          onSelectTab={setActiveTabId}
          status={status}
          selectionName={selectionState.selectionName}
          colors={colors}
          hasSelection={selectionState.hasSelection}
        />
      </main>

      <footer className="footer">
        {selectionState.analysisEndpoint && (
          <span
            className="connection-indicator"
            title={`Analysis endpoint: ${selectionState.analysisEndpoint}`}
          >
            {formatEndpoint(selectionState.analysisEndpoint)}
          </span>
        )}
        <button type="button" className="tertiary-button" onClick={handlePingClick}>
          Test Connection
        </button>
      </footer>
    </div>
  );
}

function extractAnalysisData(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;

  if (
    Array.isArray(record["heuristics"]) ||
    Array.isArray(record["accessibility"]) ||
    Array.isArray(record["psychology"]) ||
    Array.isArray(record["impact"]) ||
    Array.isArray(record["recommendations"])
  ) {
    return value;
  }

  const nested = record["analysis"];
  if (nested && typeof nested === "object") {
    return nested;
  }

  return value;
}

function normalizeAnalysis(data: unknown): StructuredAnalysis {
  if (!data || typeof data !== "object") {
    return DEFAULT_STRUCTURED_ANALYSIS;
  }

  const record = data as Record<string, unknown>;
  const accessibilityNormalized = normalizeAccessibility(record["accessibility"]);

  return {
    summary: asString(record["summary"]),
    receipts: normalizeReceipts(record["receipts"]),
    copywriting: normalizeCopywriting(record["uxCopywriting"] ?? record["copywriting"]),
    accessibilityExtras: accessibilityNormalized.extras,
    heuristics: normalizeHeuristics(record["heuristics"]),
    accessibility: accessibilityNormalized.items,
    psychology: normalizePsychology(record["psychology"]),
    impact: normalizeImpact(record["impact"]),
    recommendations: normalizeRecommendations(record["recommendations"])
  };
}

function normalizeReceipts(value: unknown): AnalysisSource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const entry = item as Record<string, unknown>;
      const rawTitle = asString(entry["title"]);
      const url = asString(entry["url"]);
      const domainTier = asString(entry["domainTier"]);
      const usedFor = asString(entry["usedFor"]);
      const publishedYear = normalizePublishedYear(entry["publishedYear"]);

      if (!rawTitle && !url) {
        return null;
      }

      return {
        title: rawTitle ?? url ?? "Source",
        url,
        domainTier,
        usedFor,
        publishedYear
      };
    })
    .filter(Boolean) as AnalysisSource[];
}

function normalizeCopywriting(value: unknown): CopywritingContent {
  const base: CopywritingContent = {
    heading: undefined,
    summary: undefined,
    guidance: [],
    sources: []
  };

  if (!value) {
    return base;
  }

  if (typeof value === "string") {
    return {
      ...base,
      summary: value
    };
  }

  if (Array.isArray(value)) {
    return {
      ...base,
      guidance: asStringArray(value)
    };
  }

  if (typeof value !== "object") {
    return base;
  }

  const record = value as Record<string, unknown>;
  const heading =
    asString(record["heading"]) ?? asString(record["title"]) ?? asString(record["label"]);
  const summary =
    asString(record["summary"]) ??
    asString(record["description"]) ??
    asString(record["copy"]);
  const guidance = mergeUniqueStrings([
    asStringArray(record["guidance"]),
    asStringArray(record["notes"]),
    asStringArray(record["recommendations"]),
    asStringArray(record["examples"]),
    asStringArray(record["bullets"])
  ]);
  const sources = normalizeReceipts(record["sources"]);

  return {
    heading,
    summary,
    guidance,
    sources
  };
}

function normalizeSection(section: unknown): AnalysisSectionItem[] {
  if (!Array.isArray(section)) {
    return [];
  }

  return section
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const entry = item as Record<string, unknown>;
      const title = asString(entry["title"]) ?? asString(entry["name"]);
      let description = asString(entry["description"]) ?? asString(entry["summary"]);

      const additionalDetails = asStringArray(entry["insights"]);
      if (additionalDetails.length) {
        description = mergeDescription(description, additionalDetails.join("\n"));
      }

      const severity =
        asString(entry["severity"]) ?? asString(entry["intent"]) ?? asString(entry["status"]);

      if (!title && !description) {
        return null;
      }

      return {
        title: title ?? "Insight",
        description,
        severity
      };
    })
    .filter(Boolean) as AnalysisSectionItem[];
}

function normalizeRecommendations(recommendations: unknown): string[] {
  if (Array.isArray(recommendations)) {
    return recommendations.filter((item): item is string => typeof item === "string");
  }

  if (!recommendations || typeof recommendations !== "object") {
    return [];
  }

  const record = recommendations as Record<string, unknown>;
  const priority = asString(record["priority"]);
  const immediate = asStringArray(record["immediate"]).map(
    (text) => `[Immediate] ${text}`
  );
  const longTerm = asStringArray(record["longTerm"]).map((text) => `[Long-term] ${text}`);

  const combined = [...immediate, ...longTerm];

  if (priority) {
    combined.unshift(`Overall priority: ${priority}`);
  }

  return combined;
}

function normalizeHeuristics(section: unknown): AnalysisSectionItem[] {
  if (!Array.isArray(section)) {
    return normalizeSection(section);
  }

  return section
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const entry = item as Record<string, unknown>;
      const title = asString(entry["name"]) ?? asString(entry["title"]);
      let description = asString(entry["description"]) ?? asString(entry["summary"]);

      const insights = asStringArray(entry["insights"]);
      if (insights.length) {
        description = mergeDescription(description, insights.join("\n"));
      }

      const score = typeof entry["score"] === "number" ? entry["score"] : undefined;
      if (score !== undefined) {
        description = mergeDescription(description, `Score: ${score}/5`);
      }

      const severity =
        asString(entry["severity"]) ??
        (score !== undefined ? severityFromScore(score) : undefined);

      if (!title && !description) {
        return null;
      }

      return {
        title: title ?? "Insight",
        description,
        severity
      };
    })
    .filter(Boolean) as AnalysisSectionItem[];
}

function severityFromScore(score: number): string {
  if (score <= 2) {
    return "high";
  }
  if (score === 3) {
    return "medium";
  }
  return "low";
}

function normalizeAccessibility(
  section: unknown
): { items: AnalysisSectionItem[]; extras: AccessibilityExtras } {
  const extras: AccessibilityExtras = {
    contrastScore: undefined,
    summary: undefined,
    issues: [],
    recommendations: [],
    sources: []
  };

  if (Array.isArray(section)) {
    return {
      items: normalizeSection(section),
      extras
    };
  }

  if (!section || typeof section !== "object") {
    return {
      items: [],
      extras
    };
  }

  const record = section as Record<string, unknown>;
  const items: AnalysisSectionItem[] = [];
  extras.contrastScore = normalizeContrastScore(record["contrastScore"]);
  extras.summary = asString(record["summary"]);
  extras.issues = asStringArray(record["issues"]);
  extras.recommendations = asStringArray(record["recommendations"]);
  extras.sources = normalizeReceipts(record["sources"]);

  const categories = Array.isArray(record["categories"]) ? record["categories"] : [];

  for (const category of categories) {
    if (!category || typeof category !== "object") {
      continue;
    }

    const entry = category as Record<string, unknown>;
    const title = asString(entry["title"]) ?? asString(entry["id"]) ?? "Accessibility";
    const severity = asString(entry["status"]);

    const parts: string[] = [];
    const summary = asString(entry["summary"]);
    if (summary) {
      parts.push(summary);
    }

    const checks = asStringArray(entry["checks"]);
    if (checks.length) {
      parts.push(`Checks: ${checks.join("; ")}`);
    }

    const issues = asStringArray(entry["issues"]);
    if (issues.length) {
      parts.push(`Issues: ${issues.join("; ")}`);
    }

  const recs = asStringArray(entry["recommendations"]);
  if (recs.length) {
    parts.push(`Next Steps: ${recs.join("; ")}`);
  }

    const description = parts.join("\n") || undefined;

    if (!title && !description) {
      continue;
    }

    items.push({
      title: title ?? "Accessibility",
      description,
      severity
    });
  }

  return {
    items,
    extras
  };
}

function normalizeImpact(section: unknown): AnalysisSectionItem[] {
  if (Array.isArray(section)) {
    return normalizeSection(section);
  }

  if (!section || typeof section !== "object") {
    return [];
  }

  const record = section as Record<string, unknown>;
  const items: AnalysisSectionItem[] = [];

  const summary = asString(record["summary"]);
  if (summary) {
    items.push({ title: "Overview", description: summary });
  }

  const areas = Array.isArray(record["areas"]) ? record["areas"] : [];

  for (const area of areas) {
    if (!area || typeof area !== "object") {
      continue;
    }

    const entry = area as Record<string, unknown>;
    const title = asString(entry["category"]) ?? "Impact";
    const severity = asString(entry["severity"]);

    const parts: string[] = [];
    const areaSummary = asString(entry["summary"]);
    if (areaSummary) {
      parts.push(areaSummary);
    }

  const recs = asStringArray(entry["recommendations"]);
  if (recs.length) {
    parts.push(`Next Steps: ${recs.join("; ")}`);
  }

    const description = parts.join("\n") || undefined;

    if (!title && !description) {
      continue;
    }

    items.push({
      title,
      description,
      severity
    });
  }

  return items;
}

function normalizePsychology(section: unknown): AnalysisSectionItem[] {
  if (Array.isArray(section)) {
    return normalizeSection(section);
  }

  if (!section || typeof section !== "object") {
    return [];
  }

  const record = section as Record<string, unknown>;
  const items: AnalysisSectionItem[] = [];

  const persuasion = Array.isArray(record["persuasionTechniques"])
    ? record["persuasionTechniques"]
    : [];
  for (const technique of persuasion) {
    if (!technique || typeof technique !== "object") {
      continue;
    }

    const entry = technique as Record<string, unknown>;
    const title = asString(entry["title"]) ?? "Persuasion Technique";
    const severity = asString(entry["intent"]);

    const parts: string[] = [];
    const summary = asString(entry["summary"]);
    if (summary) {
      parts.push(summary);
    }

    const stage = asString(entry["stage"]);
    if (stage) {
      parts.push(`Stage: ${stage}`);
    }

    const guardrail = asString(entry["guardrail"]);
    if (guardrail) {
      parts.push(`Guardrail: ${guardrail}`);
    }

  const recs = asStringArray(entry["recommendations"]);
  if (recs.length) {
    parts.push(`Next Steps: ${recs.join("; ")}`);
  }

    const signals = asStringArray(entry["signals"]);
    if (signals.length) {
      parts.push(`Signals: ${signals.join(", ")}`);
    }

    items.push({
      title,
      description: parts.join("\n") || undefined,
      severity
    });
  }

  const triggers = Array.isArray(record["behavioralTriggers"])
    ? record["behavioralTriggers"]
    : [];
  for (const trigger of triggers) {
    if (!trigger || typeof trigger !== "object") {
      continue;
    }

    const entry = trigger as Record<string, unknown>;
    const title = asString(entry["title"]) ?? "Behavioral Trigger";
    const severity = asString(entry["intent"]);

    const parts: string[] = [];
    const summary = asString(entry["summary"]);
    if (summary) {
      parts.push(summary);
    }

    const stage = asString(entry["stage"]);
    if (stage) {
      parts.push(`Stage: ${stage}`);
    }

    const guardrail = asString(entry["guardrail"]);
    if (guardrail) {
      parts.push(`Guardrail: ${guardrail}`);
    }

  const recs = asStringArray(entry["recommendations"]);
  if (recs.length) {
    parts.push(`Next Steps: ${recs.join("; ")}`);
  }

    const signals = asStringArray(entry["signals"]);
    if (signals.length) {
      parts.push(`Signals: ${signals.join(", ")}`);
    }

    items.push({
      title,
      description: parts.join("\n") || undefined,
      severity
    });
  }

  if (!items.length) {
    return normalizeSection(section);
  }

  return items;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const sanitized = stripObservationTokens(trimmed);
  return sanitized.length ? sanitized : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const results: string[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (!trimmed) {
        continue;
      }

      const sanitized = stripObservationTokens(trimmed);
      if (sanitized) {
        results.push(sanitized);
      }
    }
  }
  return results;
}

function mergeUniqueStrings(groups: string[][]): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const group of groups) {
    for (const item of group) {
      if (!seen.has(item)) {
        seen.add(item);
        results.push(item);
      }
    }
  }

  return results;
}

function normalizePublishedYear(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function normalizeContrastScore(value: unknown): number | undefined {
  const numberValue = asNumber(value);

  if (numberValue === undefined) {
    return undefined;
  }

  const rounded = Math.round(numberValue);
  if (!Number.isFinite(rounded)) {
    return undefined;
  }

  return Math.min(5, Math.max(1, rounded));
}

function mergeDescription(base: string | undefined, addition: string | undefined): string | undefined {
  if (!addition) {
    return base;
  }

  if (!base) {
    return addition;
  }

  return `${base}\n${addition}`;
}

type CollapsibleBodyElement = "div" | "ul" | "ol";

interface CollapsibleCardProps {
  title: string;
  children: ReactNode;
  icon?: LucideIcon;
  className?: string;
  bodyClassName?: string;
  bodyElement?: CollapsibleBodyElement;
}

function CollapsibleCard({
  title,
  children,
  icon: Icon,
  className,
  bodyClassName,
  bodyElement = "div"
}: CollapsibleCardProps): JSX.Element {
  const BodyComponent = bodyElement as CollapsibleBodyElement;

  return (
    <section className={classNames("card", className)} data-card-surface="true">
      <header className="card-header">
        <h2 className="card-heading">
          {Icon ? <Icon className="card-heading-icon" aria-hidden="true" /> : null}
          <span className="card-heading-title accordion-title">{title}</span>
        </h2>
      </header>
      <BodyComponent className={classNames("card-body", bodyClassName)}>{children}</BodyComponent>
    </section>
  );
}

function SummaryCard({
  summary,
  receipts
}: {
  summary?: string;
  receipts: AnalysisSource[];
}): JSX.Element | null {
  const hasSummary = typeof summary === "string" && summary.trim().length > 0;
  const summaryLines = useMemo(() => {
    if (!hasSummary || !summary) {
      return [];
    }

    return summary
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }, [hasSummary, summary]);

  if (!hasSummary && receipts.length === 0) {
    return null;
  }

  return (
    <CollapsibleCard
      title="UX Summary"
      icon={Eye}
      className="summary-card"
      bodyClassName="summary-content"
    >
      {summaryLines.length > 0 && (
        <CardSection title="Highlights">
          <div className="summary-text">
            {summaryLines.map((line, index) => (
              <p key={`summary-line-${index}`}>{line}</p>
            ))}
          </div>
        </CardSection>
      )}
      <SourceList heading="Sources" sources={receipts} className="summary-sources" />
    </CollapsibleCard>
  );
}

function CopywritingCard({ copywriting }: { copywriting: CopywritingContent }): JSX.Element | null {
  const hasSummary = typeof copywriting.summary === "string" && copywriting.summary.trim().length > 0;
  const hasGuidance = copywriting.guidance.length > 0;
  const hasSources = copywriting.sources.length > 0;

  const summaryParagraphs = useMemo(() => {
    if (!hasSummary || !copywriting.summary) {
      return [];
    }

    return copywriting.summary
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }, [copywriting.summary, hasSummary]);

  if (!hasSummary && !hasGuidance && !hasSources) {
    return null;
  }

  return (
    <CollapsibleCard
      title={copywriting.heading || "UX Copy"}
      icon={Type}
      className="copywriting-card"
      bodyClassName="copywriting-content"
    >
      {summaryParagraphs.length > 0 && (
        <CardSection title="Summary">
          <div className="copywriting-summary">
            {summaryParagraphs.map((line, index) => (
              <p key={`copywriting-summary-${index}`}>{line}</p>
            ))}
          </div>
        </CardSection>
      )}
      {hasGuidance && (
        <CardSection title="Guidance">
          <ul className="copywriting-guidance">
            {copywriting.guidance.map((item, index) => (
              <li key={`copywriting-guidance-${index}`}>{item}</li>
            ))}
          </ul>
        </CardSection>
      )}
      <SourceList heading="Sources" sources={copywriting.sources} className="copywriting-sources" />
    </CollapsibleCard>
  );
}

function AccessibilityAccordion({
  items,
  extras,
  icon: Icon = Accessibility
}: {
  items: AnalysisSectionItem[];
  extras: AccessibilityExtras;
  icon?: LucideIcon;
}): JSX.Element | null {
  const extrasContentAvailable =
    typeof extras.contrastScore === "number" ||
    (typeof extras.summary === "string" && extras.summary.trim().length > 0) ||
    (extras.issues?.length ?? 0) > 0 ||
    (extras.recommendations?.length ?? 0) > 0 ||
    (extras.sources?.length ?? 0) > 0;
  const hasItems = items.length > 0;

  if (!extrasContentAvailable && !hasItems) {
    return null;
  }

  return <AccessibilityAccordionPanel items={items} extras={extras} icon={Icon} />;
}

function AccessibilityAccordionPanel({
  items,
  extras,
  icon: IconComponent = Accessibility
}: {
  items: AnalysisSectionItem[];
  extras: AccessibilityExtras;
  icon?: LucideIcon;
}): JSX.Element {
  const {
    contrastScore,
    summary,
    issues = [],
    recommendations = [],
    sources = []
  } = extras;

  const hasContrast = typeof contrastScore === "number";
  const hasSummary = typeof summary === "string" && summary.trim().length > 0;
  const hasIssues = issues.length > 0;
  const hasRecommendations = recommendations.length > 0;
  const hasSources = sources.length > 0;
  const hasExtrasContent = hasContrast || hasSummary || hasIssues || hasRecommendations || hasSources;

  return (
    <section className="card accessibility-card" data-card-surface="true">
      <header className="card-header">
        <h2 className="card-heading">
          {IconComponent && <IconComponent className="card-heading-icon" aria-hidden="true" />}
          <span className="card-heading-title accordion-title">Accessibility</span>
        </h2>
      </header>
      <ul className="card-body">
        {(hasIssues || hasRecommendations) && (
          <li className="card-item">
            <CardSection
              title="Issues & Next Steps"
              className="card-item-section accessibility-section"
            >
              {hasIssues && (
                <div className="accessibility-subsection">
                  <p className="accessibility-subsection-title">Issues</p>
                  <ul className="accessibility-list">
                    {issues.map((issue, index) => (
                      <li key={`accessibility-issue-${index}`}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              {hasRecommendations && (
                <div className="accessibility-subsection">
                  <p className="accessibility-subsection-title">Next Steps</p>
                  <ul className="accessibility-list">
                    {recommendations.map((item, index) => (
                      <li key={`accessibility-rec-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardSection>
          </li>
        )}

        {(hasContrast || hasSummary) && (
          <li className="card-item">
            <CardSection
              title="Accessibility Overview"
              className="card-item-section accessibility-content"
            >
              {hasContrast && typeof contrastScore === "number" && (
                <div className="accessibility-contrast">
                  <span className="accessibility-contrast-label">Contrast Score</span>
                  <span
                    className={classNames(
                      "accessibility-contrast-value",
                      contrastLevelClass(contrastScore)
                    )}
                  >
                    {contrastScore}/5
                  </span>
                </div>
              )}
              {hasSummary && <p className="accessibility-summary">{summary}</p>}
            </CardSection>
          </li>
        )}

        {hasSources && (
          <li className="card-item">
            <SourceList
              heading="Sources"
              sources={sources}
              className="card-item-section accessibility-sources"
            />
          </li>
        )}

        {items.map((item, index) => (
          <li key={`accessibility-item-${index}`} className="card-item">
            <CardSection
              className="card-item-section"
              title={item.title}
              actions={item.severity ? <SeverityBadge severity={item.severity} /> : undefined}
            >
              {item.description && <p className="card-item-description">{item.description}</p>}
            </CardSection>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SourceList({
  heading,
  sources,
  className
}: {
  heading?: string;
  sources: AnalysisSource[];
  className?: string;
}): JSX.Element | null {
  if (!sources.length) {
    return null;
  }

  const sectionClassName = ["source-section", className]
    .filter((value): value is string => Boolean(value))
    .join(" ");

  return (
    <CardSection title={heading} className={sectionClassName}>
      <ul className="source-list">
        {sources.map((source, index) => (
          <li key={`source-${index}`} className="source-item">
            <SourceListItem source={source} />
          </li>
        ))}
      </ul>
    </CardSection>
  );
}

function SourceListItem({ source }: { source: AnalysisSource }): JSX.Element {
  const metaParts = useMemo(() => {
    const parts: string[] = [];

    if (source.domainTier) {
      parts.push(source.domainTier.toUpperCase());
    }

    if (typeof source.publishedYear === "number") {
      parts.push(String(source.publishedYear));
    }

    if (source.usedFor) {
      parts.push(source.usedFor);
    }

    return parts;
  }, [source.domainTier, source.publishedYear, source.usedFor]);

  return (
    <div className="source-item-content">
      {source.url ? (
        <a className="source-link link" href={source.url} target="_blank" rel="noreferrer">
          {source.title}
        </a>
      ) : (
        <span className="source-link">{source.title}</span>
      )}
      {metaParts.length > 0 && <span className="source-meta">{metaParts.join(" • ")}</span>}
    </div>
  );
}

function AccordionSection({
  title,
  items,
  icon: Icon
}: {
  title: string;
  items: AnalysisSectionItem[];
  icon?: LucideIcon;
}): JSX.Element | null {
  if (!items.length) {
    return null;
  }

  return (
    <section className="card accordion accordion-open" data-card-surface="true">
      <header className="card-header">
        <h2 className="card-heading accordion-button">
          {Icon && <Icon className="card-heading-icon" aria-hidden="true" />}
          <span className="card-heading-title accordion-title">{title}</span>
        </h2>
      </header>
      <ul className="card-body">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="card-item">
            <CardSection
              className="card-item-section"
              title={item.title}
              actions={item.severity ? <SeverityBadge severity={item.severity} /> : undefined}
            >
              {item.description && <p className="card-item-description">{item.description}</p>}
            </CardSection>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RecommendationsAccordion({
  recommendations,
  icon: Icon = Lightbulb
}: {
  recommendations: string[];
  icon?: LucideIcon;
}): JSX.Element | null {
  const partitioned = useMemo(() => partitionRecommendationEntries(recommendations), [
    recommendations
  ]);

  if (!recommendations.length) {
    return null;
  }

  return (
    <section className="card accordion accordion-open" data-card-surface="true">
      <header className="card-header">
        <h2 className="card-heading accordion-button">
          <Icon className="card-heading-icon" aria-hidden="true" />
          <span className="card-heading-title accordion-title">Next Steps</span>
        </h2>
      </header>
      <ul className="card-body">
        {partitioned.priority && (
          <li className="card-item">
            <CardSection title="Overall Priority">
              <p className="card-item-description">{partitioned.priority}</p>
            </CardSection>
          </li>
        )}

        {partitioned.immediate.length > 0 && (
          <li className="card-item">
            <CardSection title="Immediate Actions">
              {partitioned.immediate.map((item, index) => (
                <p key={`immediate-${index}`} className="card-item-description">
                  {item}
                </p>
              ))}
            </CardSection>
          </li>
        )}

        {partitioned.longTerm.length > 0 && (
          <li className="card-item">
            <CardSection title="Long-term Next Steps">
              {partitioned.longTerm.map((item, index) => (
                <p key={`longterm-${index}`} className="card-item-description">
                  {item}
                </p>
              ))}
            </CardSection>
          </li>
        )}

        {partitioned.general.map((item, index) => (
          <li key={`general-${index}`} className="card-item">
            <CardSection>
              <p className="card-item-description">{item}</p>
            </CardSection>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AnalysisLoader({
  status,
  selectionName
}: {
  status: AnalysisStatus;
  selectionName?: string;
}): JSX.Element | null {
  const isAnalyzing = status === "analyzing";
  const isCancelling = status === "cancelling";

  if (!isAnalyzing && !isCancelling) {
    return null;
  }

  const selectionLabel = selectionName ? `“${selectionName}”` : "your selection";
  const headline = isCancelling
    ? "Canceling analysis…"
    : selectionName
    ? `Analyzing ${selectionLabel}…`
    : "Analyzing your selection…";
  const bodyCopy = isCancelling
    ? "We’ll tidy up and return to your previous insights."
    : "Cozying up your insights with the UXBiblio library.";

  return (
    <div className="loader-overlay" role="status" aria-live="polite">
      <div className="loader-card" data-state={isCancelling ? "cancelling" : "analyzing"}>
        <span className="loader-ambient" aria-hidden="true" />
        <UXBiblioMark className="loader-logo" />
        <p className="loader-title">{headline}</p>
        <p className="loader-subcopy">{bodyCopy}</p>
      </div>
    </div>
  );
}

function UXBiblioMark({ className }: { className?: string }): JSX.Element {
  const gradientId = useId();
  const pageId = `${gradientId}-page-highlight`;

  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="8%" y1="12%" x2="92%" y2="88%">
          <stop offset="0%" stopColor="#f986ad" />
          <stop offset="100%" stopColor="#d75695" />
        </linearGradient>
        <linearGradient id={pageId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff6fb" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ffe1f0" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill={`url(#${gradientId})`} />
      <rect
        x="18.5"
        y="22"
        width="13.5"
        height="22"
        rx="6"
        ry="6"
        fill={`url(#${pageId})`}
      />
      <rect
        x="32"
        y="22"
        width="13.5"
        height="22"
        rx="6"
        ry="6"
        fill="#fff6fb"
        fillOpacity="0.92"
      />
      <path
        d="M32 25.5c-1.7 0-3.1 1.1-3.1 2.4v17.1c1.3-0.9 2.6-1.4 3.1-1.6 0.5 0.2 1.8 0.7 3.1 1.6V27.9c0-1.3-1.4-2.4-3.1-2.4z"
        fill="#f9bfd8"
        opacity="0.85"
      />
      <path
        d="M32 18.8c2.2 0 3.8 1.8 3.8 3.8 0 3-3.8 5-3.8 5s-3.8-2-3.8-5c0-2 1.6-3.8 3.8-3.8z"
        fill="#fff6fb"
      />
      <circle cx="45.2" cy="18.8" r="2.6" fill="#ffe5f2" />
    </svg>
  );
}

function AnalysisTabsLayout({
  tabs,
  activeTabId,
  onSelectTab,
  status,
  selectionName,
  colors,
  hasSelection
}: {
  tabs: AnalysisTabDescriptor[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  status: AnalysisStatus;
  selectionName?: string;
  colors: PaletteColor[];
  hasSelection: boolean;
}): JSX.Element {
  const isAnalyzing = status === "analyzing";
  const isCancelling = status === "cancelling";
  const isSuccess = status === "success";
  const isError = status === "error";
  const selectionLabel = selectionName ? `“${selectionName}”` : "This selection";
  const shouldShowInitialEmpty = !hasSelection || status === "idle" || status === "ready";
  const navigationRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const navigationTouchYRef = useRef<number | null>(null);

  useEffect(() => {
    const navigationElement = navigationRef.current;
    const panelElement = panelRef.current;

    if (!navigationElement || !panelElement) {
      return;
    }

    const panelNode: HTMLDivElement = panelElement;

    function syncPanelScroll(deltaY: number): boolean {
      const { scrollHeight, clientHeight } = panelNode;

      if (scrollHeight <= clientHeight) {
        return false;
      }

      const previousTop = panelNode.scrollTop;
      panelNode.scrollTop = Math.max(
        0,
        Math.min(scrollHeight - clientHeight, previousTop + deltaY)
      );

      if (panelNode.scrollTop !== previousTop) {
        return true;
      }

      return false;
    }

    function handleNavigationWheel(event: WheelEvent) {
      const consumed = syncPanelScroll(event.deltaY);
      if (consumed) {
        event.preventDefault();
      }
    }

    function handleNavigationTouch(event: TouchEvent) {
      if (event.touches.length !== 1) {
        return;
      }

      const touch = event.touches[0];
      const lastPosition = navigationTouchYRef.current;

      if (lastPosition === null) {
        navigationTouchYRef.current = touch.clientY;
        return;
      }

      const deltaY = lastPosition - touch.clientY;
      navigationTouchYRef.current = touch.clientY;
      const consumed = syncPanelScroll(deltaY);

      if (consumed) {
        event.preventDefault();
      }
    }

    function resetTouchState() {
      navigationTouchYRef.current = null;
    }

    navigationElement.addEventListener("wheel", handleNavigationWheel, { passive: false });
    navigationElement.addEventListener("touchmove", handleNavigationTouch, {
      passive: false
    });
    navigationElement.addEventListener("touchend", resetTouchState);
    navigationElement.addEventListener("touchcancel", resetTouchState);

    return () => {
      navigationElement.removeEventListener("wheel", handleNavigationWheel);
      navigationElement.removeEventListener("touchmove", handleNavigationTouch);
      navigationElement.removeEventListener("touchend", resetTouchState);
      navigationElement.removeEventListener("touchcancel", resetTouchState);
    };
  }, [tabs]);

  if (!tabs.length) {
    return (
      <div className="analysis-grid">
        <section className="analysis-panel" role="tabpanel" id="analysis-panel">
          <EmptyTabNotice message="No analysis details are available for this run." />
        </section>
      </div>
    );
  }

  function renderTabBody(tab: AnalysisTabDescriptor): JSX.Element {
    if (shouldShowInitialEmpty) {
      return (
        <EmptyTabNotice
          icon={Frame}
          title="No frame selected"
          message={INITIAL_ANALYSIS_EMPTY_MESSAGE}
        />
      );
    }

    if (isAnalyzing) {
      const paletteHasColors = tab.id === "color-palette" && colors.length > 0;
      if (paletteHasColors) {
        const paletteBody = tab.render();
        return paletteBody ?? <EmptyTabNotice message={tab.emptyMessage} />;
      }
      if (tab.hasContent) {
        const body = tab.render();
        return body ?? <EmptyTabNotice message={tab.emptyMessage} />;
      }
      const analyzingMessage = selectionName
        ? `Analyzing ${selectionLabel}… Insights will appear here once ready.`
        : "Analyzing selection… Insights will appear here once ready.";
      return <EmptyTabNotice message={analyzingMessage} />;
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
    <div className="analysis-grid">
      <nav
        ref={navigationRef}
        className="analysis-navigation"
        aria-label="Analysis sections"
      >
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
                  className={classNames("analysis-tab", isActive && "is-active")}
                  onClick={() => onSelectTab(tab.id)}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={panelId}
                  aria-expanded={isActive}
                  tabIndex={isActive ? 0 : -1}
                  data-has-content={
                    tab.hasContent && !shouldShowInitialEmpty ? "true" : "false"
                  }
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
      </nav>
      <div ref={panelRef} className="analysis-panel" data-layout-stable="true">
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

function AnalysisControls({
  status,
  analyzeDisabled,
  hasSelection,
  onAnalyze,
  onCancel
}: {
  status: AnalysisStatus;
  analyzeDisabled: boolean;
  hasSelection: boolean;
  onAnalyze: () => void;
  onCancel: () => void;
}): JSX.Element {
  const isAnalyzing = status === "analyzing";
  const isCancelling = status === "cancelling";
  const analyzeLabel = isAnalyzing
    ? "Analyzing…"
    : isCancelling
    ? "Canceling…"
    : ANALYZE_BUTTON_COPY;

  return (
    <div className="analysis-controls">
      <button
        type="button"
        className="primary-button"
        onClick={onAnalyze}
        disabled={analyzeDisabled}
        title={hasSelection ? undefined : NO_SELECTION_TOOLTIP}
      >
        {analyzeLabel}
      </button>
      {(isAnalyzing || isCancelling) && (
        <button
          type="button"
          className="secondary-button"
          onClick={onCancel}
          disabled={!isAnalyzing}
          title="Stop the current analysis."
        >
          Cancel
        </button>
      )}
    </div>
  );
}

function ColorPalette({ colors }: { colors: PaletteColor[] }): JSX.Element | null {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const visibleColors = useMemo(
    () => colors.slice(0, MAX_PALETTE_COLORS),
    [colors]
  );

  useEffect(() => {
    logger.debug("[UI] ColorPalette render", {
      total: colors.length,
      visible: visibleColors.length,
      preview: visibleColors.slice(0, 5)
    });
  }, [colors, visibleColors.length]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(
    async (hex: string) => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }

      try {
        if (
          typeof navigator !== "undefined" &&
          navigator.clipboard &&
          typeof navigator.clipboard.writeText === "function"
        ) {
          await navigator.clipboard.writeText(hex);
        } else {
          const input = document.createElement("textarea");
          input.value = hex;
          input.setAttribute("readonly", "");
          input.style.position = "absolute";
          input.style.opacity = "0";
          document.body.appendChild(input);
          input.select();
          document.execCommand("copy");
          document.body.removeChild(input);
        }

        setCopiedHex(hex);
        resetTimerRef.current = window.setTimeout(() => {
          setCopiedHex((current) => (current === hex ? null : current));
          resetTimerRef.current = null;
        }, COPY_FEEDBACK_DURATION);
      } catch (error) {
        logger.warn("[UI] Failed to copy hex value", { hex, error });
        setCopiedHex(null);
      }
    },
    []
  );

  if (visibleColors.length === 0) {
    return null;
  }

  return (
    <CollapsibleCard title="Color Palette" icon={Palette}>
      <div className="palette-grid">
        {visibleColors.map((color) => (
          <CardSection key={color.hex} className="palette-swatch">
            <span className="swatch" style={{ backgroundColor: color.hex }} aria-hidden />
            <div className="swatch-meta">
              <span className="swatch-hex">{color.hex}</span>
              <button
                type="button"
                className={`swatch-copy-button${copiedHex === color.hex ? " copied" : ""}`}
                onClick={() => handleCopy(color.hex)}
                aria-label={`Copy ${color.hex} to clipboard`}
                title={copiedHex === color.hex ? "Copied" : "Copy hex value"}
              >
                {copiedHex === color.hex ? (
                  <CheckIcon className="swatch-copy-icon" />
                ) : (
                  <CopyIcon className="swatch-copy-icon" />
                )}
              </button>
            </div>
            {color.name && <span className="swatch-name">{color.name}</span>}
            {copiedHex === color.hex && <CopyTooltip />}
          </CardSection>
        ))}
      </div>
    </CollapsibleCard>
  );
}

function contrastLevelClass(score: number): string {
  if (score <= 1) {
    return "contrast-level-low";
  }
  if (score <= 3) {
    return "contrast-level-medium";
  }
  return "contrast-level-high";
}

function partitionRecommendationEntries(entries: string[]): {
  priority: string | null;
  immediate: string[];
  longTerm: string[];
  general: string[];
} {
  const immediate: string[] = [];
  const longTerm: string[] = [];
  const general: string[] = [];
  let priority: string | null = null;

  for (const entry of entries) {
    if (typeof entry !== "string") {
      continue;
    }

    const trimmed = entry.trim();

    if (/^overall priority:/i.test(trimmed)) {
      priority = trimmed.replace(/^overall priority:\s*/i, "").trim();
      continue;
    }

    if (/^\[immediate]/i.test(trimmed)) {
      immediate.push(trimmed.replace(/^\[immediate]\s*/i, "").trim());
      continue;
    }

    if (/^\[long-term]/i.test(trimmed)) {
      longTerm.push(trimmed.replace(/^\[long-term]\s*/i, "").trim());
      continue;
    }

    general.push(trimmed);
  }

  return { priority, immediate, longTerm, general };
}

function CopyIcon(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M6 2a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a1 1 0 0 1 0-2h4V2H8v1a1 1 0 0 1-2 0V2ZM3 4h5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 2v7h5V6H3Z" />
    </svg>
  );
}

function CheckIcon(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M6.25 12.25 2.5 8.5l1.41-1.41 2.34 2.33 5.34-5.34 1.41 1.42-6.75 6.75Z" />
    </svg>
  );
}

function CopyTooltip(): JSX.Element {
  return (
    <span className="copy-tooltip" role="status" aria-live="assertive">
      Copied
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }): JSX.Element {
  const label = severity.trim();
  const level =
    label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "default";
  return <span className={`severity severity-${level}`}>{label}</span>;
}

interface CardSectionProps {
  title?: string;
  className?: string;
  actions?: ReactNode;
  children: ReactNode;
}

function CardSection({ title, className, actions, children }: CardSectionProps): JSX.Element {
  const hasHeader = Boolean(title) || Boolean(actions);

  return (
    <section className={classNames("card-section", className)}>
      {hasHeader && (
        <div className="card-section-header">
          {title ? <h3 className="card-section-title">{title}</h3> : null}
          {actions ? <div className="card-section-actions">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

interface StatusBannerProps {
  intent: BannerIntent;
  message: string;
  hasSelection: boolean;
}

const StatusBanner = forwardRef<HTMLDivElement, StatusBannerProps>(function StatusBanner(
  { intent, message, hasSelection },
  ref
) {
  const tone = resolveBannerIntent(intent, hasSelection);
  const isAlert = tone === "danger" || tone === "warning";

  return (
    <div
      ref={ref}
      className={`status-banner ${tone}`}
      role={isAlert ? "alert" : "status"}
      aria-live={isAlert ? "assertive" : "polite"}
      aria-atomic="true"
      tabIndex={isAlert ? -1 : undefined}
    >
      {message}
    </div>
  );
});

function resolveBannerIntent(intent: BannerIntent, hasSelection: boolean): BannerIntent {
  if (intent === "danger" && !hasSelection) {
    return "warning";
  }

  return intent;
}

function formatEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    const path = url.pathname.replace(/\/$/, "");
    return `${url.origin}${path}`;
  } catch {
    return endpoint;
  }
}
