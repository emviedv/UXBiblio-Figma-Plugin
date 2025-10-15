import { exportSelectionToBase64 } from "../utils/export";
import { sendAnalysisRequest } from "../utils/analysis";
import { prepareAnalysisPayload } from "../utils/analysis-payload";
import type { PluginToUiMessage } from "../types/messages";
import type { DebugChannel } from "../services/debug-service";

export interface AnalysisRuntimeChannels {
  analysis: DebugChannel;
  selection: DebugChannel;
  network: DebugChannel;
}

export interface AnalysisRuntimeOptions {
  analysisEndpoint: string;
  promptVersion: string;
  notifyUI: (message: PluginToUiMessage) => void;
  channels: AnalysisRuntimeChannels;
}

type ExportableNode = SceneNode & { exportAsync(settings?: ExportSettings): Promise<Uint8Array> };

interface ActiveAnalysis {
  selectionId: string;
  selectionName: string;
  controller?: AbortController;
  cancelled: boolean;
  notified: boolean;
}

interface CachedAnalysis {
  version: number;
  promptVersion: string;
  image: string;
  analysis?: unknown;
  metadata?: unknown;
  exportedAt?: string;
}

const NO_SELECTION_ERROR = "Please select a Frame or Group before analyzing.";

export function createAnalysisRuntime({
  analysisEndpoint,
  promptVersion,
  notifyUI,
  channels
}: AnalysisRuntimeOptions) {
  let activeAnalysis: ActiveAnalysis | null = null;
  const analysisCache = new Map<string, CachedAnalysis>();

  function syncSelectionStatus(): void {
    const selection = figma.currentPage.selection;
    const hasSelection = selection.length > 0;
    const selectionName = hasSelection && selection[0].name ? selection[0].name : undefined;

    const warnings: string[] = [];

    channels.selection.debug("Sync selection status", {
      hasSelection,
      firstSelectionType: hasSelection ? selection[0].type : undefined,
      selectionName,
      selectionIds: selection.map((node) => node.id),
      warnings
    });

    notifyUI({
      type: "SELECTION_STATUS",
      payload: {
        hasSelection,
        selectionName,
        warnings: warnings.length ? warnings : undefined,
        analysisEndpoint
      }
    });
  }

  async function handleAnalyzeSelection(): Promise<void> {
    const selectedNode = getFirstExportableNode();

    if (!selectedNode) {
      notifyUI({ type: "ANALYSIS_ERROR", error: NO_SELECTION_ERROR });
      return;
    }

    const selectionName = selectedNode.name || "Unnamed Selection";
    const selectionId = selectedNode.id;
    const selectionVersion = getNodeVersion(selectedNode);

    const cacheEntry = prepareCacheEntry(selectionId, selectionVersion);

    if (cacheEntry && cacheEntry.promptVersion === promptVersion && cacheEntry.version === selectionVersion) {
      const cachedAnalysis = cacheEntry.analysis;
      const summary = summarizeAnalysisContent(cachedAnalysis);
      if (cachedAnalysis && !isStructurallyEmptyAnalysis(cachedAnalysis)) {
        channels.analysis.info("Serving cached analysis result", {
          selectionId,
          selectionVersion,
          ...summary
        });
        const exportedAt = cacheEntry.exportedAt ?? new Date().toISOString();
        notifyUI({
          type: "ANALYSIS_RESULT",
          payload: {
            selectionName,
            analysis: cachedAnalysis,
            metadata: cacheEntry.metadata,
            exportedAt
          }
        });
        return;
      }

      channels.analysis.warn("Ignoring cached analysis with empty payload", {
        selectionId,
        selectionVersion,
        promptVersion,
        ...summary
      });
    }

    if (cacheEntry?.analysis && cacheEntry.promptVersion !== promptVersion) {
      channels.analysis.debug("Bypassing cached analysis due to prompt version mismatch", {
        selectionId,
        previousPromptVersion: cacheEntry.promptVersion,
        nextPromptVersion: promptVersion
      });
    }

    if (cacheEntry?.exportedAt && !cacheEntry?.analysis) {
      channels.analysis.debug("Cached export present without analysis payload; fetching fresh analysis", {
        selectionId,
        selectionVersion
      });
    }

    const controller = createAbortController();
    const analysisRun: ActiveAnalysis = {
      selectionId,
      selectionName,
      controller,
      cancelled: false,
      notified: false
    };

    activeAnalysis = analysisRun;

    notifyUI({
      type: "ANALYSIS_IN_PROGRESS",
      payload: { selectionName }
    });
    channels.analysis.debug("Dispatched ANALYSIS_IN_PROGRESS", {
      selectionId,
      selectionName
    });

    channels.analysis.info("Starting analysis", {
      selectionId,
      selectionName,
      nodeType: selectedNode.type
    });

    try {
      const base64Image = await getOrExportBase64Image(selectionId, selectionVersion, selectionName, selectedNode);

      if (analysisRun.cancelled) {
        channels.analysis.debug("Analysis cancelled after export", { selectionName });
        notifyAnalysisCancelled(analysisRun);
        return;
      }

      const requestStart = Date.now();
      channels.analysis.info("Sending analysis request", {
        endpoint: analysisEndpoint,
        selectionName
      });
      const metadata: Record<string, unknown> = buildMetadata(selectedNode, selectionName);

      const response = await sendAnalysisRequest(
        analysisEndpoint,
        {
          image: base64Image,
          selectionName,
          metadata
        },
        { signal: controller?.signal }
      );

      channels.analysis.info("Analysis response received", {
        selectionName,
        durationMs: Date.now() - requestStart
      });

      const exportedAt = new Date().toISOString();
      const preparedPayload = prepareAnalysisPayload(response, {
        selectionName,
        exportedAt
      });

      const isEmptyAnalysis = isStructurallyEmptyAnalysis(preparedPayload.analysis);
      const analysisSummary = summarizeAnalysisContent(preparedPayload.analysis);

      if (isEmptyAnalysis) {
        channels.analysis.warn("Analysis response contained no actionable insights", {
          selectionId,
          selectionName,
          endpoint: analysisEndpoint,
          ...analysisSummary
        });
      } else {
        channels.analysis.debug("Caching analysis result", {
          selectionId,
          selectionName,
          ...analysisSummary
        });
      }

      analysisCache.set(selectionId, {
        version: selectionVersion,
        image: base64Image,
        promptVersion,
        analysis: isEmptyAnalysis ? undefined : preparedPayload.analysis,
        metadata: isEmptyAnalysis ? undefined : preparedPayload.metadata,
        exportedAt
      });

      if (analysisRun.cancelled) {
        channels.analysis.debug("Analysis cancelled after response received", { selectionName });
        notifyAnalysisCancelled(analysisRun);
        return;
      }

      notifyUI({
        type: "ANALYSIS_RESULT",
        payload: preparedPayload
      });
      channels.analysis.debug("Dispatched ANALYSIS_RESULT", {
        selectionId,
        selectionName
      });
    } catch (error) {
      if (analysisRun.cancelled) {
        channels.analysis.debug("Analysis cancelled during pipeline", {
          selectionName,
          error: error instanceof Error ? error.message : String(error)
        });
        notifyAnalysisCancelled(analysisRun);
        return;
      }

      const message = error instanceof Error ? error.message : "The analysis could not be completed.";
      notifyUI({ type: "ANALYSIS_ERROR", error: message });
      channels.analysis.error("Analysis pipeline failed", error);
    } finally {
      if (activeAnalysis === analysisRun) {
        activeAnalysis = null;
      }
    }
  }

  function cancelActiveAnalysis(): void {
    if (!activeAnalysis) {
      channels.analysis.debug("Cancel requested but no active analysis is running");
      notifyUI({
        type: "ANALYSIS_CANCELLED",
        payload: { selectionName: "" }
      });
      return;
    }

    if (activeAnalysis.cancelled) {
      channels.analysis.debug("Cancel requested but analysis already marked for cancellation", {
        selectionName: activeAnalysis.selectionName
      });
      return;
    }

    activeAnalysis.cancelled = true;
    channels.analysis.info("Cancelling active analysis", {
      selectionName: activeAnalysis.selectionName,
      selectionId: activeAnalysis.selectionId
    });

    if (activeAnalysis.controller) {
      activeAnalysis.controller.abort();
    }
  }

  function notifyAnalysisCancelled(run: ActiveAnalysis): void {
    if (run.notified) {
      return;
    }

    run.notified = true;
    channels.analysis.info("Analysis cancelled", {
      selectionName: run.selectionName,
      selectionId: run.selectionId
    });

    notifyUI({
      type: "ANALYSIS_CANCELLED",
      payload: { selectionName: run.selectionName }
    });
  }

  async function pingConnection(): Promise<void> {
    const url = new URL(analysisEndpoint);
    const healthUrl = `${url.origin}/health`;

    try {
      channels.network.debug("Pinging analysis health endpoint", { healthUrl });
      const res = await fetch(healthUrl, { method: "GET" });
      const ok = res.ok;
      notifyUI({ type: "PING_RESULT", payload: { ok, endpoint: healthUrl } });
      channels.network.debug("Ping result", { ok, status: res.status });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      notifyUI({ type: "PING_RESULT", payload: { ok: false, endpoint: healthUrl, message } });
      channels.network.error("Ping request errored", error);
    }
  }

  function prepareCacheEntry(selectionId: string, selectionVersion: number): CachedAnalysis | undefined {
    const existingCache = analysisCache.get(selectionId);

    if (existingCache && existingCache.version !== selectionVersion) {
      analysisCache.delete(selectionId);
      return undefined;
    }

    if (existingCache && existingCache.promptVersion !== promptVersion) {
      channels.analysis.info("Evicting cached analysis due to prompt version change", {
        selectionId,
        previousPromptVersion: existingCache.promptVersion,
        nextPromptVersion: promptVersion
      });
      analysisCache.set(selectionId, {
        version: existingCache.version,
        image: existingCache.image,
        promptVersion
      });
      return analysisCache.get(selectionId);
    }

    return existingCache;
  }

  async function getOrExportBase64Image(
    selectionId: string,
    selectionVersion: number,
    selectionName: string,
    node: ExportableNode
  ): Promise<string> {
    const cachedImageEntry = analysisCache.get(selectionId);
    if (cachedImageEntry?.image && cachedImageEntry.version === selectionVersion) {
      channels.analysis.debug("Reusing cached export", {
        selectionName,
        selectionId,
        selectionVersion,
        promptVersion: cachedImageEntry.promptVersion
      });
      return cachedImageEntry.image;
    }

    channels.analysis.debug("Exporting selection to base64", { selectionName });
    const exportStart = Date.now();
    const base64Image = await exportSelectionToBase64(node);
    const exportDuration = Date.now() - exportStart;
    channels.analysis.debug("Export complete", {
      selectionName,
      exportDurationMs: exportDuration,
      imageSizeKb: Math.round(base64Image.length / 1024)
    });
    analysisCache.set(selectionId, {
      version: selectionVersion,
      promptVersion,
      image: base64Image
    });
    return base64Image;
  }

  return {
    syncSelectionStatus,
    handleAnalyzeSelection,
    cancelActiveAnalysis,
    pingConnection
  };
}

function getFirstExportableNode(): ExportableNode | null {
  const selection = figma.currentPage.selection;

  if (!selection.length) {
    return null;
  }

  for (const node of selection) {
    if (isExportableNode(node)) {
      return node;
    }
  }

  return null;
}

function isExportableNode(node: SceneNode): node is ExportableNode {
  return typeof (node as ExportableNode).exportAsync === "function";
}

function hasDimensions(node: SceneNode): node is SceneNode & { width: number; height: number } {
  return (
    "width" in node &&
    "height" in node &&
    typeof (node as { width?: number }).width === "number" &&
    typeof (node as { height?: number }).height === "number"
  );
}

function getNodeVersion(node: SceneNode): number {
  if ("version" in node && typeof (node as { version: number }).version === "number") {
    return (node as { version: number }).version;
  }

  return 0;
}

function createAbortController(): AbortController | undefined {
  if (typeof AbortController === "function") {
    return new AbortController();
  }

  return undefined;
}

function buildMetadata(node: SceneNode, selectionName: string): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    nodeType: node.type,
    name: selectionName
  };

  if (hasDimensions(node)) {
    metadata.frame = {
      width: node.width,
      height: node.height
    };
  }

  return metadata;
}

function isStructurallyEmptyAnalysis(analysis: unknown): boolean {
  if (!analysis || typeof analysis !== "object") {
    return true;
  }

  const record = analysis as Record<string, unknown>;

  if (hasMeaningfulText(record["summary"]) || hasMeaningfulText(record["scopeNote"])) {
    return false;
  }

  if (
    hasMeaningfulCollection(record["heuristics"]) ||
    hasMeaningfulCollection(record["psychology"]) ||
    hasMeaningfulCollection(record["impact"]) ||
    hasMeaningfulCollection(record["recommendations"]) ||
    hasMeaningfulCollection(record["flows"]) ||
    hasMeaningfulCollection(record["industries"]) ||
    hasMeaningfulCollection(record["uiElements"])
  ) {
    return false;
  }

  const copywriting = record["uxCopywriting"] ?? record["copywriting"];
  if (isCopywritingMeaningful(copywriting)) {
    return false;
  }

  if (hasAccessibilityContent(record["accessibility"])) {
    return false;
  }

  const confidence = record["confidence"];
  if (confidence && typeof confidence === "object") {
    const confidenceRecord = confidence as Record<string, unknown>;
    if (
      hasMeaningfulText(confidenceRecord["level"]) ||
      hasMeaningfulText(confidenceRecord["rationale"])
    ) {
      return false;
    }
  }

  return true;
}

function summarizeAnalysisContent(analysis: unknown): {
  heuristicsCount: number;
  accessibilityCount: number;
  psychologyCount: number;
  impactCount: number;
  recommendationsCount: number;
} {
  if (!analysis || typeof analysis !== "object") {
    return {
      heuristicsCount: 0,
      accessibilityCount: 0,
      psychologyCount: 0,
      impactCount: 0,
      recommendationsCount: 0
    };
  }

  const record = analysis as Record<string, unknown>;
  return {
    heuristicsCount: getArrayLength(record["heuristics"]),
    accessibilityCount: getArrayLength(record["accessibility"]),
    psychologyCount: getArrayLength(record["psychology"]),
    impactCount: getArrayLength(record["impact"]),
    recommendationsCount: getArrayLength(record["recommendations"])
  };
}

function getArrayLength(value: unknown): number {
  if (Array.isArray(value)) {
    return value.length;
  }
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length;
  }
  return 0;
}

function hasMeaningfulText(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (value && typeof value === "object" && "summary" in (value as Record<string, unknown>)) {
    return hasMeaningfulText((value as Record<string, unknown>)["summary"]);
  }
  return false;
}

function hasNonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function hasMeaningfulPrimitive(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value === "boolean") {
    return true;
  }
  return false;
}

function hasMeaningfulCollection(value: unknown, visited = new Set<unknown>()): boolean {
  if (hasNonEmptyArray(value)) {
    return true;
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  if (visited.has(value)) {
    return false;
  }

  visited.add(value);

  const entries = Object.values(value as Record<string, unknown>);
  for (const entry of entries) {
    if (hasMeaningfulPrimitive(entry) || hasMeaningfulText(entry)) {
      return true;
    }
    if (hasNonEmptyArray(entry)) {
      return true;
    }
    if (entry && typeof entry === "object") {
      if (hasMeaningfulCollection(entry, visited)) {
        return true;
      }
    }
  }

  return false;
}

function isCopywritingMeaningful(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (hasMeaningfulText(record["heading"]) || hasMeaningfulText(record["summary"])) {
    return true;
  }
  return (
    hasNonEmptyArray(record["guidance"]) ||
    hasNonEmptyArray(record["sources"])
  );
}

function hasAccessibilityContent(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record["contrastScore"] === "number" ||
    hasMeaningfulText(record["summary"]) ||
    hasNonEmptyArray(record["issues"]) ||
    hasNonEmptyArray(record["recommendations"]) ||
    hasNonEmptyArray(record["sources"]) ||
    hasNonEmptyArray(record["categories"])
  );
}
