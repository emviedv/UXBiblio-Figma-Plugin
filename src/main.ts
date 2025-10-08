import type { PaletteColor, PluginToUiMessage, UiToPluginMessage } from "./types/messages";
import { extractSolidFillHexes } from "./utils/colors";
import { buildAnalysisEndpoint } from "./utils/endpoints";
import { exportSelectionToBase64 } from "./utils/export";
import { sendAnalysisRequest } from "./utils/analysis";
import { prepareAnalysisPayload } from "./utils/analysis-payload";
import { debugService } from "./services/debug-service";

declare const __UI_HTML__: string | undefined;
declare const __ANALYSIS_BASE_URL__: string | undefined;

const UI_SHELL_FALLBACK = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>UXBiblio Analyzer</title>
    <style>
      body { font-family: "Inter", "Segoe UI", system-ui, sans-serif; margin: 0; padding: 24px; }
      h1 { font-size: 18px; margin-bottom: 12px; }
      p { color: #555; line-height: 1.4; }
      code { background: #f4f4f4; padding: 2px 4px; border-radius: 4px; }
    </style>
  </head>
  <body>
    <h1>UXBiblio Analyzer UI Missing</h1>
    <p>
      The plugin UI bundle has not been generated yet. Run <code>npm run build:ui</code>
      (or <code>npm run dev</code>) so the interface can load inside Figma.
    </p>
  </body>
</html>`;

const UI_WIDTH = 420;
const UI_HEIGHT = 640;
const ANALYSIS_ENDPOINT = buildAnalysisEndpoint(__ANALYSIS_BASE_URL__);

type ExportableNode = SceneNode & { exportAsync(settings?: ExportSettings): Promise<Uint8Array> };

const runtimeLog = debugService.forContext("Runtime");
const uiBridgeLog = debugService.forContext("UI Bridge");
const analysisLog = debugService.forContext("Analysis");
const selectionLog = debugService.forContext("Selection");
const networkLog = debugService.forContext("Network");

interface ActiveAnalysis {
  selectionId: string;
  selectionName: string;
  controller?: AbortController;
  cancelled: boolean;
  notified: boolean;
}

let activeAnalysis: ActiveAnalysis | null = null;
const analysisCache = new Map<
  string,
  {
    version: number;
    image: string;
    analysis?: unknown;
    metadata?: unknown;
    colors?: PaletteColor[];
    exportedAt?: string;
  }
>();

showPluginUI();
syncSelectionStatus();

runtimeLog.info("Plugin booted", {
  endpoint: ANALYSIS_ENDPOINT,
  debugLogging: debugService.isEnabled()
});

figma.on("selectionchange", () => {
  syncSelectionStatus();
});

figma.ui.onmessage = (rawMessage: UiToPluginMessage) => {
  uiBridgeLog.debug("Received message from UI", rawMessage);
  switch (rawMessage.type) {
    case "UI_READY": {
      uiBridgeLog.debug("UI reported ready");
      syncSelectionStatus();
      break;
    }
    case "ANALYZE_SELECTION": {
      analysisLog.info("Analyze request received from UI");
      handleAnalyzeSelection().catch((error) => {
        const message = error instanceof Error ? error.message : "Unknown error";
        notifyUI({ type: "ANALYSIS_ERROR", error: message });
        figma.notify(message, { error: true });
        analysisLog.error("Analysis request failed", error);
      });
      break;
    }
    case "CANCEL_ANALYSIS": {
      analysisLog.info("Cancel request received from UI");
      cancelActiveAnalysis();
      break;
    }
    case "PING_CONNECTION": {
      networkLog.debug("Ping request received from UI");
      pingConnection().catch((error) => {
        const message = error instanceof Error ? error.message : "Unknown error";
        notifyUI({
          type: "PING_RESULT",
          payload: { ok: false, endpoint: ANALYSIS_ENDPOINT, message }
        });
        networkLog.error("Ping connection failed", error);
      });
      break;
    }
    default: {
      // No-op for now; future messages can be handled here.
      break;
    }
  }
};

function showPluginUI() {
  const html =
    typeof __UI_HTML__ === "string" && __UI_HTML__.trim().length > 0
      ? __UI_HTML__
      : UI_SHELL_FALLBACK;

  runtimeLog.debug("Showing plugin UI", {
    usingFallback: html === UI_SHELL_FALLBACK
  });

  figma.showUI(html, {
    width: UI_WIDTH,
    height: UI_HEIGHT,
    themeColors: true
  });
}

async function handleAnalyzeSelection() {
  const selectedNode = getFirstExportableNode();

  if (!selectedNode) {
    const error = "Please select a Frame or Group before analyzing.";
    notifyUI({ type: "ANALYSIS_ERROR", error });
    figma.notify(error, { error: true });
    return;
  }

  const selectionName = selectedNode.name || "Unnamed Selection";
  const selectionId = selectedNode.id;
  const selectionVersion = getNodeVersion(selectedNode);
  const existingCache = analysisCache.get(selectionId);

  if (existingCache && existingCache.version !== selectionVersion) {
    analysisCache.delete(selectionId);
  }

  const colors = extractSolidFillHexes(selectedNode);
  analysisLog.debug("Extracted color palette", { count: colors.length });

  const upToDateCache = analysisCache.get(selectionId);

  if (upToDateCache?.analysis) {
    analysisLog.info("Serving cached analysis result", {
      selectionId,
      selectionVersion
    });
    const exportedAt = upToDateCache.exportedAt ?? new Date().toISOString();
    analysisCache.set(selectionId, {
      ...upToDateCache,
      colors
    });
    notifyUI({
      type: "ANALYSIS_RESULT",
      payload: {
        selectionName,
        analysis: upToDateCache.analysis,
        metadata: upToDateCache.metadata,
        colors,
        exportedAt
      }
    });
    figma.notify("Analysis ready.");
    return;
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
    payload: { selectionName, colors }
  });

  analysisLog.info("Starting analysis", {
    selectionId,
    selectionName,
    nodeType: selectedNode.type
  });

  try {
    const exportStart = Date.now();
    let base64Image: string;
    const cachedImageEntry = analysisCache.get(selectionId);

    if (cachedImageEntry?.image && cachedImageEntry.version === selectionVersion) {
      analysisLog.debug("Reusing cached export", {
        selectionName,
        selectionId,
        selectionVersion
      });
      base64Image = cachedImageEntry.image;
    } else {
      analysisLog.debug("Exporting selection to base64", { selectionName });
      base64Image = await exportSelectionToBase64(selectedNode);
      const exportDuration = Date.now() - exportStart;
      analysisLog.debug("Export complete", {
        selectionName,
        exportDurationMs: exportDuration,
        imageSizeKb: Math.round(base64Image.length / 1024)
      });
      analysisCache.set(selectionId, {
        version: selectionVersion,
        image: base64Image
      });
    }

    if (analysisRun.cancelled) {
      analysisLog.debug("Analysis cancelled after export", { selectionName });
      notifyAnalysisCancelled(analysisRun);
      return;
    }

    const requestStart = Date.now();
    analysisLog.info("Sending analysis request", {
      endpoint: ANALYSIS_ENDPOINT,
      selectionName
    });
    const response = await sendAnalysisRequest(
      ANALYSIS_ENDPOINT,
      {
        image: base64Image,
        selectionName
      },
      { signal: controller?.signal }
    );

    analysisLog.info("Analysis response received", {
      selectionName,
      durationMs: Date.now() - requestStart
    });

    const exportedAt = new Date().toISOString();
    const preparedPayload = prepareAnalysisPayload(response, {
      selectionName,
      exportedAt,
      colors
    });

    analysisCache.set(selectionId, {
      version: selectionVersion,
      image: base64Image,
      analysis: preparedPayload.analysis,
      metadata: preparedPayload.metadata,
      colors,
      exportedAt
    });

    if (analysisRun.cancelled) {
      analysisLog.debug("Analysis cancelled after response received", { selectionName });
      notifyAnalysisCancelled(analysisRun);
      return;
    }

    notifyUI({
      type: "ANALYSIS_RESULT",
      payload: preparedPayload
    });

    figma.notify("Analysis ready.");
  } catch (error) {
    if (analysisRun.cancelled) {
      analysisLog.debug("Analysis cancelled during pipeline", {
        selectionName,
        error: error instanceof Error ? error.message : String(error)
      });
      notifyAnalysisCancelled(analysisRun);
      return;
    }

    const message =
      error instanceof Error ? error.message : "The analysis could not be completed.";
    notifyUI({ type: "ANALYSIS_ERROR", error: message });
    figma.notify(message, { error: true });
    analysisLog.error("Analysis pipeline failed", error);
  } finally {
    if (activeAnalysis === analysisRun) {
      activeAnalysis = null;
    }
  }
}

function createAbortController(): AbortController | undefined {
  if (typeof AbortController === "function") {
    return new AbortController();
  }

  return undefined;
}

function cancelActiveAnalysis() {
  if (!activeAnalysis) {
    analysisLog.debug("Cancel requested but no active analysis is running");
    notifyUI({
      type: "ANALYSIS_CANCELLED",
      payload: { selectionName: "" }
    });
    return;
  }

  if (activeAnalysis.cancelled) {
    analysisLog.debug("Cancel requested but analysis already marked for cancellation", {
      selectionName: activeAnalysis.selectionName
    });
    return;
  }

  activeAnalysis.cancelled = true;
  analysisLog.info("Cancelling active analysis", {
    selectionName: activeAnalysis.selectionName,
    selectionId: activeAnalysis.selectionId
  });

  if (activeAnalysis.controller) {
    activeAnalysis.controller.abort();
  }
}

function notifyAnalysisCancelled(run: ActiveAnalysis) {
  if (run.notified) {
    return;
  }

  run.notified = true;
  analysisLog.info("Analysis cancelled", {
    selectionName: run.selectionName,
    selectionId: run.selectionId
  });

  notifyUI({
    type: "ANALYSIS_CANCELLED",
    payload: { selectionName: run.selectionName }
  });
  figma.notify("Analysis canceled.");
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

function getNodeVersion(node: SceneNode): number {
  if ("version" in node && typeof (node as { version: number }).version === "number") {
    return (node as { version: number }).version;
  }

  return 0;
}

function syncSelectionStatus() {
  const selection = figma.currentPage.selection;
  const hasSelection = selection.length > 0;
  const selectionName =
    hasSelection && selection[0].name ? selection[0].name : undefined;

  const warnings: string[] = [];

  selectionLog.debug("Sync selection status", {
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
      analysisEndpoint: ANALYSIS_ENDPOINT
    }
  });
}

function notifyUI(message: PluginToUiMessage) {
  uiBridgeLog.debug("Posting message to UI", message);
  figma.ui.postMessage(message);
}

async function pingConnection() {
  const url = new URL(ANALYSIS_ENDPOINT);
  // Try a simple health path if present, otherwise root
  const healthUrl = `${url.origin}/health`;

  try {
    networkLog.debug("Pinging analysis health endpoint", { healthUrl });
    const res = await fetch(healthUrl, { method: "GET" });
    const ok = res.ok;
    notifyUI({ type: "PING_RESULT", payload: { ok, endpoint: healthUrl } });
    networkLog.debug("Ping result", { ok, status: res.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    notifyUI({ type: "PING_RESULT", payload: { ok: false, endpoint: healthUrl, message } });
    networkLog.error("Ping request errored", error);
  }
}
