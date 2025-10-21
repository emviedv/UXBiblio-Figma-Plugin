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
    <title>UXBiblio – AI-Powered UX Analysis & Heuristic Evaluator</title>
    <style>
      body { font-family: "Inter", "Segoe UI", system-ui, sans-serif; margin: 0; padding: 24px; }
      h1 { font-size: 18px; margin-bottom: 12px; }
      p { color: #555; font-size: 14px; line-height: 1.5; }
      code { background: #f4f4f4; padding: 2px 4px; border-radius: 4px; }
    </style>
  </head>
  <body>
    <h1>UXBiblio – AI-Powered UX Analysis & Heuristic Evaluator UI Missing</h1>
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
const AUTH_PORTAL_URL = resolveAuthPortalUrl(__ANALYSIS_BASE_URL__);
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
      const portalOpened = openExternalUrl(UPGRADE_URL);
      if (!portalOpened) {
        figma.notify("Open UXBiblio Pro: https://uxbiblio.com/pro");
      }
      break;
    }
    case "OPEN_AUTH_PORTAL": {
      uiBridgeLog.info("Auth CTA clicked; opening authentication portal", { url: AUTH_PORTAL_URL });
      const portalOpened = openExternalUrl(AUTH_PORTAL_URL);
      void runtime.handleAuthPortalOpened();
      if (!portalOpened) {
        figma.notify(`Sign in to UXBiblio: ${AUTH_PORTAL_URL}`);
      }
      break;
    }
    case "SYNC_ACCOUNT_STATUS": {
      uiBridgeLog.info("Account status sync requested by UI", {
        status: rawMessage.payload.status
      });
      void runtime.syncAccountStatus(rawMessage.payload.status).catch((error) => {
        uiBridgeLog.error("Failed to sync account status from UI", error);
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


function notifyUI(message: PluginToUiMessage) {
  uiBridgeLog.debug("Posting message to UI", message);
  figma.ui.postMessage(message);
}

function resolveAuthPortalUrl(analysisBase: string | undefined): string {
  const DEFAULT_AUTH_URL = "https://uxbiblio.com/auth";
  const LOCAL_AUTH_URL = "http://localhost:3115/auth";
  if (typeof analysisBase !== "string" || analysisBase.trim().length === 0) {
    return DEFAULT_AUTH_URL;
  }

  try {
    const parsed = new URL(analysisBase);
    if (isLocalHostname(parsed.hostname)) {
      return LOCAL_AUTH_URL;
    }
  } catch {
    // Ignore parse failures and fall back to default host.
  }

  return DEFAULT_AUTH_URL;
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.startsWith("127.") ||
    normalized.endsWith(".local")
  );
}

function openExternalUrl(targetUrl: string): boolean {
  const apiWithOptionalOpenUrl = figma as PluginAPI & {
    openURL?: (url: string) => void | Promise<void>;
  };

  const notifyHost = (() => {
    try {
      const hostname = new URL(targetUrl).hostname;
      return `Opening ${hostname}…`;
    } catch {
      return "Opening link…";
    }
  })();

  const invoke = (handler: ((url: string) => void | Promise<void>) | undefined, label: string) => {
    if (typeof handler !== "function") {
      return false;
    }

    try {
      handler(targetUrl);
      figma.notify(notifyHost);
      return true;
    } catch (error) {
      uiBridgeLog.error(`${label} threw`, error);
      return false;
    }
  };

  try {
    figma.openExternal(targetUrl);
    figma.notify(notifyHost);
    return true;
  } catch (error) {
    uiBridgeLog.error("figma.openExternal threw", error);
  }

  if (invoke(apiWithOptionalOpenUrl.openURL, "figma.openURL")) {
    return true;
  }

  uiBridgeLog.warn("No external URL opener available; prompting manual link.", {
    targetUrl,
    hasOpenExternal: typeof figma.openExternal,
    hasOpenURL: typeof apiWithOptionalOpenUrl.openURL
  });
  return false;
}
