import promptVersionMeta from "./config/prompt-version.json";
import type { PluginToUiMessage, UiToPluginMessage } from "./types/messages";
import { debugService } from "./services/debug-service";
import { buildAnalysisEndpoint } from "./utils/endpoints";
import { createAnalysisRuntime } from "./runtime/analysisRuntime";
import { enableDebugFixForSession } from "./utils/debugFlags";
import { deriveApiBaseUrl, extractHostname, isLocalHostname } from "./utils/url";

declare const __UI_HTML__: string | undefined;
declare const __ANALYSIS_BASE_URL__: string | undefined;
declare const __LOCAL_AUTH_URL__: string | undefined;

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
const COMMAND_DEBUG_TRACING = "debug-tracing";
const invokedCommand = typeof figma.command === "string" ? figma.command : "";
const debugTracingRequested = invokedCommand === COMMAND_DEBUG_TRACING;

const runtimeLog = debugService.forContext("Runtime");
const uiBridgeLog = debugService.forContext("UI Bridge");
const analysisLog = debugService.forContext("Analysis");
const selectionLog = debugService.forContext("Selection");
const networkLog = debugService.forContext("Network");

const DEFAULT_LOCAL_AUTH_PORT = 3115;
const AUTH_PORTAL_URL = resolveAuthPortalUrl(__ANALYSIS_BASE_URL__);
const CURRENT_PROMPT_VERSION = promptVersionMeta.version ?? "0.0.0";

if (debugTracingRequested) {
  enableDebugFixForSession();
  debugService.setEnabled(true);
}

if (debugTracingRequested) {
  runtimeLog.info("Debug tracing command invoked; DEBUG_FIX enabled", {
    command: invokedCommand
  });
}

const runtime = createAnalysisRuntime({
  analysisEndpoint: ANALYSIS_ENDPOINT,
  promptVersion: CURRENT_PROMPT_VERSION,
  authPortalUrl: AUTH_PORTAL_URL,
  notifyUI,
  channels: {
    analysis: analysisLog,
    selection: selectionLog,
    network: networkLog
  }
});

showPluginUI();
void runtime.syncSelectionStatus();

runtimeLog.info("Plugin booted", {
  endpoint: ANALYSIS_ENDPOINT,
  debugLogging: debugService.isEnabled(),
  promptVersion: CURRENT_PROMPT_VERSION
});

figma.on("selectionchange", () => {
  void runtime.syncSelectionStatus();
});

figma.ui.onmessage = (rawMessage: UiToPluginMessage) => {
  uiBridgeLog.debug("Received message from UI", rawMessage);
  switch (rawMessage.type) {
    case "UI_READY": {
      uiBridgeLog.debug("UI reported ready");
      void runtime.syncSelectionStatus();
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
      const openedByUi = rawMessage.payload?.openedByUi === true;
      uiBridgeLog.info("Auth CTA dispatched", {
        openedByUi
      });

      void (async () => {
        try {
          const portalUrl = await runtime.prepareAuthPortalUrl();
          const includesBridgeToken = portalUrl.includes("figmaBridgeToken=");
          uiBridgeLog.debug("Auth portal URL prepared", {
            includesBridgeToken,
            openedByUi
          });

          let portalOpened = openedByUi;
          if (!openedByUi) {
            portalOpened = openExternalUrl(portalUrl);
            if (!portalOpened) {
              figma.notify(`Sign in to UXBiblio: ${portalUrl}`);
            }
          }

          if (portalOpened || openedByUi) {
            await runtime.handleAuthPortalOpened({
              openedByUi,
              portalOpened
            });
          } else {
            uiBridgeLog.warn("Auth portal launch failed; bridge polling skipped", {
              openedByUi,
              includesBridgeToken
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          uiBridgeLog.error("Failed to launch auth portal", { error: message });
          figma.notify("Unable to open UXBiblio auth portal. Please try again.");
        }
      })();
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
  const trimmedAnalysisBase = typeof analysisBase === "string" ? analysisBase.trim() : "";
  const rawLocalOverride = typeof __LOCAL_AUTH_URL__ === "string" ? __LOCAL_AUTH_URL__.trim() : "";

  if (trimmedAnalysisBase.length === 0) {
    return DEFAULT_AUTH_URL;
  }

  let fallbackReason: "non-local-host" | "parse-error" | undefined;
  const hostnameResolution = extractHostname(trimmedAnalysisBase);
  const localAuthUrl =
    rawLocalOverride.length > 0
      ? rawLocalOverride
      : composeDefaultLocalAuthUrl(hostnameResolution?.hostname, trimmedAnalysisBase);

  if (hostnameResolution) {
    runtimeLog.debug("Auth portal hostname resolved", {
      analysisBase: trimmedAnalysisBase,
      hostname: hostnameResolution.hostname,
      source: hostnameResolution.source,
      localOverride: rawLocalOverride.length > 0 ? rawLocalOverride : null
    });
    if (isLocalHostname(hostnameResolution.hostname)) {
      runtimeLog.debug("Using local auth portal URL", {
        resolvedUrl: localAuthUrl,
        analysisBase: trimmedAnalysisBase,
        overrideProvided: rawLocalOverride.length > 0
      });
      return localAuthUrl;
    }
    fallbackReason = "non-local-host";
  } else {
    fallbackReason = "parse-error";
    runtimeLog.debug("Failed to resolve hostname for auth portal", {
      analysisBase: trimmedAnalysisBase,
      hasUrlGlobal: typeof URL === "function"
    });
  }

  runtimeLog.debug("Auth portal URL falling back to default host", {
    analysisBase: trimmedAnalysisBase,
    hasUrlGlobal: typeof URL === "function",
    reason: fallbackReason ?? "unknown"
  });
  return DEFAULT_AUTH_URL;
}

function composeDefaultLocalAuthUrl(
  hostnameCandidate: string | undefined,
  analysisBase: string
): string {
  // Mirror the analysis base protocol so local auth stays on HTTPS when TLS is enabled.
  const hostname = hostnameCandidate && hostnameCandidate.length > 0 ? hostnameCandidate : "localhost";
  const protocol = deriveLocalAuthProtocol(analysisBase);
  const port = deriveLocalAuthPort(analysisBase);
  const formattedHost = formatHostnameForUrl(hostname);
  const portSegment = port ?? DEFAULT_LOCAL_AUTH_PORT;
  return `${protocol}${formattedHost}:${portSegment}/auth`;
}

function deriveLocalAuthProtocol(analysisBase: string): "http://" | "https://" {
  const match = analysisBase.match(/^([a-zA-Z][a-zA-Z\d+\-.]*):\/\//);
  if (match && match[1].toLowerCase() === "https") {
    return "https://";
  }

  if (typeof URL === "function") {
    try {
      const parsed = new URL(analysisBase);
      if (parsed.protocol === "https:") {
        return "https://";
      }
    } catch {
      // Ignore parsing errors; fall back to http.
    }
  }

  return "http://";
}

function deriveLocalAuthPort(analysisBase: string): number | null {
  const sanitized = typeof analysisBase === "string" ? analysisBase.trim() : "";
  if (!sanitized) {
    return null;
  }

  const ensureScheme = (candidate: string): string =>
    /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(candidate) ? candidate : `http://${candidate}`;
  const candidateWithScheme = ensureScheme(sanitized);

  if (typeof URL === "function") {
    try {
      const url = new URL(candidateWithScheme);
      if (url.port) {
        const parsed = Number.parseInt(url.port, 10);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    } catch {
      // Fall back to manual parsing below.
    }
  }

  const portMatch = candidateWithScheme.match(/:(\d+)(?:[/?#]|$)/);
  if (!portMatch) {
    return null;
  }

  const parsed = Number.parseInt(portMatch[1] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatHostnameForUrl(hostname: string): string {
  if (hostname.includes(":") && !(hostname.startsWith("[") && hostname.endsWith("]"))) {
    return `[${hostname}]`;
  }

  return hostname;
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
