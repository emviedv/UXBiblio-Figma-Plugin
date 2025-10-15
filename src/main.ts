import promptVersionMeta from "./config/prompt-version.json";
import type { PluginToUiMessage, UiToPluginMessage } from "./types/messages";
import { debugService } from "./services/debug-service";
import { buildAnalysisEndpoint } from "./utils/endpoints";
import { createAnalysisRuntime } from "./runtime/analysisRuntime";

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
      p { color: #555; font-size: 14px; line-height: 1.5; }
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
const UPGRADE_URL = "https://uxbiblio.com/pro";
const CURRENT_PROMPT_VERSION = promptVersionMeta.version ?? "0.0.0";

const runtimeLog = debugService.forContext("Runtime");
const uiBridgeLog = debugService.forContext("UI Bridge");
const analysisLog = debugService.forContext("Analysis");
const selectionLog = debugService.forContext("Selection");
const networkLog = debugService.forContext("Network");

const runtime = createAnalysisRuntime({
  analysisEndpoint: ANALYSIS_ENDPOINT,
  promptVersion: CURRENT_PROMPT_VERSION,
  notifyUI,
  channels: {
    analysis: analysisLog,
    selection: selectionLog,
    network: networkLog
  }
});

showPluginUI();
runtime.syncSelectionStatus();

runtimeLog.info("Plugin booted", {
  endpoint: ANALYSIS_ENDPOINT,
  debugLogging: debugService.isEnabled(),
  promptVersion: CURRENT_PROMPT_VERSION
});

figma.on("selectionchange", () => {
  runtime.syncSelectionStatus();
});

figma.ui.onmessage = (rawMessage: UiToPluginMessage) => {
  uiBridgeLog.debug("Received message from UI", rawMessage);
  switch (rawMessage.type) {
    case "UI_READY": {
      uiBridgeLog.debug("UI reported ready");
      runtime.syncSelectionStatus();
      break;
    }
    case "ANALYZE_SELECTION": {
      analysisLog.info("Analyze request received from UI");
      runtime.handleAnalyzeSelection().catch((error) => {
        const message = error instanceof Error ? error.message : "Unknown error";
        notifyUI({ type: "ANALYSIS_ERROR", error: message });
        analysisLog.error("Analysis request failed", error);
      });
      break;
    }
    case "CANCEL_ANALYSIS": {
      analysisLog.info("Cancel request received from UI");
      runtime.cancelActiveAnalysis();
      break;
    }
    case "PING_CONNECTION": {
      networkLog.debug("Ping request received from UI");
      runtime.pingConnection().catch((error) => {
        const message = error instanceof Error ? error.message : "Unknown error";
        notifyUI({
          type: "PING_RESULT",
          payload: { ok: false, endpoint: ANALYSIS_ENDPOINT, message }
        });
        networkLog.error("Ping connection failed", error);
      });
      break;
    }
    case "OPEN_UPGRADE": {
      uiBridgeLog.info("Upgrade CTA clicked; opening upgrade URL", { url: UPGRADE_URL });
      const maybeOpenURL = (figma as PluginAPI & { openURL?: (url: string) => void }).openURL;
      if (typeof maybeOpenURL === "function") {
        try {
          maybeOpenURL.call(figma, UPGRADE_URL);
          figma.notify("Opening UXBiblio Pro in your browser…");
        } catch (error) {
          uiBridgeLog.error("Failed to open upgrade URL", error);
          figma.notify("Unable to open the upgrade page. Try again in a browser.");
        }
      } else {
        uiBridgeLog.warn("figma.openURL is unavailable; prompting user with manual link.");
        figma.notify("Open UXBiblio Pro: https://uxbiblio.com/pro");
      }
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


function notifyUI(message: PluginToUiMessage) {
  uiBridgeLog.debug("Posting message to UI", message);
  figma.ui.postMessage(message);
}

