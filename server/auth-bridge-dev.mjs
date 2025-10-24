import { randomBytes } from "node:crypto";

export const DEV_BRIDGE_POLL_INTERVAL_MS = 3_000;
export const DEV_BRIDGE_COMPLETION_DELAY_MS = 750;
export const DEV_BRIDGE_DEFAULT_TTL_MS = 5 * 60 * 1000;

let currentCompletionDelayMs = DEV_BRIDGE_COMPLETION_DELAY_MS;
let currentTtlMs = DEV_BRIDGE_DEFAULT_TTL_MS;
let currentPollIntervalMs = DEV_BRIDGE_POLL_INTERVAL_MS;

const bridgeStore = new Map();
const consumedStore = new Map();

function now() {
  return Date.now();
}

function buildTrialPayload() {
  return {
    accountStatus: "trial",
    account: {
      id: "dev-trial",
      status: "trial",
      plan: "trial"
    },
    credits: {
      totalFreeCredits: 0,
      remainingFreeCredits: 0
    },
    reason: "dev-auth-bridge"
  };
}

function serializeIso(timestamp) {
  return new Date(timestamp).toISOString();
}

function escapeHtml(value) {
  if (typeof value !== "string" || value.length === 0) {
    return "";
  }
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function createDevAuthBridgeToken({ analysisEndpoint } = {}) {
  const token = randomBytes(24).toString("hex");
  const createdAt = now();
  const expiresAt = createdAt + currentTtlMs;

  bridgeStore.set(token, {
    token,
    analysisEndpoint: typeof analysisEndpoint === "string" ? analysisEndpoint : null,
    createdAt,
    expiresAt,
    readyAt: createdAt + currentCompletionDelayMs,
    completedAt: null,
    consumedAt: null,
    status: "pending",
    payload: buildTrialPayload(),
    pollAfterMs: currentPollIntervalMs
  });

  return {
    token,
    expiresAt,
    pollAfterMs: currentPollIntervalMs
  };
}

export function pollDevAuthBridgeToken(token, { consume = false } = {}) {
  const entry = bridgeStore.get(token);
  if (!entry) {
    const consumedEntry = consumedStore.get(token);
    if (consumedEntry) {
      if (now() >= consumedEntry.expiresAt) {
        consumedStore.delete(token);
        return { type: "not_found" };
      }
      return { type: "gone" };
    }
    return { type: "not_found" };
  }

  const current = now();
  if (current >= entry.expiresAt) {
    bridgeStore.delete(token);
    return { type: "expired" };
  }

  if (entry.status === "pending" && current >= entry.readyAt) {
    entry.status = "completed";
    entry.completedAt = current;
  }

  if (entry.status === "pending") {
    return {
      type: "pending",
      response: {
        status: "pending",
        accountStatus: null,
        reason: null,
        payload: null,
        expiresAt: serializeIso(entry.expiresAt),
        completedAt: null,
        consumedAt: null,
        pollAfterMs: entry.pollAfterMs
      }
    };
  }

  if (consume) {
    if (entry.consumedAt) {
      bridgeStore.delete(token);
      consumedStore.set(token, { expiresAt: entry.expiresAt });
      return { type: "gone" };
    }

    entry.consumedAt = current;
  }

  const response = {
    status: "completed",
    accountStatus: entry.payload.accountStatus,
    reason: "signin",
    payload: entry.payload,
    expiresAt: serializeIso(entry.expiresAt),
    completedAt: serializeIso(entry.completedAt ?? current),
    consumedAt: entry.consumedAt ? serializeIso(entry.consumedAt) : null,
    pollAfterMs: entry.pollAfterMs
  };

  if (consume) {
    const consumedAt = entry.consumedAt ? serializeIso(entry.consumedAt) : null;
    consumedStore.set(token, { expiresAt: entry.expiresAt });
    bridgeStore.delete(token);
    return {
      type: "completed",
      response: {
        ...response,
        consumedAt
      }
    };
  }

  return {
    type: "completed",
    response
  };
}

export function clearDevAuthBridgeTokens() {
  bridgeStore.clear();
  consumedStore.clear();
}

export function setDevAuthBridgeConfig({ completionDelayMs, ttlMs, pollIntervalMs } = {}) {
  if (typeof completionDelayMs === "number" && completionDelayMs > 0) {
    currentCompletionDelayMs = completionDelayMs;
  }
  if (typeof ttlMs === "number" && ttlMs > 0) {
    currentTtlMs = ttlMs;
  }
  if (typeof pollIntervalMs === "number" && pollIntervalMs > 0) {
    currentPollIntervalMs = pollIntervalMs;
  }
}

export function resetDevAuthBridgeConfig() {
  currentCompletionDelayMs = DEV_BRIDGE_COMPLETION_DELAY_MS;
  currentTtlMs = DEV_BRIDGE_DEFAULT_TTL_MS;
  currentPollIntervalMs = DEV_BRIDGE_POLL_INTERVAL_MS;
}

export function renderDevAuthPortalPage({ token, analysisEndpoint } = {}) {
  const rawToken = typeof token === "string" ? token.trim() : "";
  const safeToken = escapeHtml(rawToken);
  const hasToken = safeToken.length > 0;
  const tokenForJs = JSON.stringify(rawToken);
  const rawEndpoint =
    typeof analysisEndpoint === "string" && analysisEndpoint.length > 0
      ? analysisEndpoint
      : "http://localhost:3115/api/analyze";
  const safeEndpoint = escapeHtml(rawEndpoint);
  const endpointForJs = JSON.stringify(rawEndpoint);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>UXBiblio Local Auth Portal</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: light dark;
        font-family: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
        background: #111827;
        color: #f3f4f6;
      }
      body {
        margin: 0;
        padding: 40px 32px;
      }
      main {
        max-width: 520px;
        margin: 0 auto;
        background: rgba(15, 23, 42, 0.65);
        border: 1px solid rgba(148, 163, 184, 0.35);
        border-radius: 16px;
        padding: 32px 28px;
        backdrop-filter: blur(18px);
      }
      h1 {
        margin: 0 0 16px;
        font-size: 24px;
        letter-spacing: -0.01em;
      }
      p {
        margin: 0 0 16px;
        font-size: 15px;
        line-height: 1.45;
      }
      code {
        font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
        background: rgba(59, 130, 246, 0.15);
        color: #bfdbfe;
        padding: 2px 6px;
        border-radius: 6px;
        font-size: 90%;
      }
      .status {
        margin-top: 24px;
        padding: 16px 18px;
        background: rgba(34, 197, 94, 0.14);
        color: #bbf7d0;
        border: 1px solid rgba(34, 197, 94, 0.45);
        border-radius: 12px;
        font-size: 14px;
      }
      .status strong {
        font-weight: 600;
      }
      .hint {
        margin-top: 18px;
        font-size: 13px;
        color: rgba(226, 232, 240, 0.75);
      }
    </style>
  </head>
  <body>
    <main>
      <h1>UXBiblio Dev Auth Portal</h1>
      <p>
        You’re running the local auth bridge stub. The Figma plugin will poll
        <code>${safeEndpoint}</code>
        and auto-complete the sign-in flow once this page confirms the token.
      </p>
      <p>
        This page can stay open. The plugin will close it automatically after the
        bridge finishes. If you need to reset, return to Figma and click “Sign In” again.
      </p>
      ${
        hasToken
          ? `<div class="status" data-token="${safeToken}">
        <strong>Active bridge token:</strong>
        <code>${safeToken.slice(-6)}</code>
      </div>`
          : `<div class="status">
        <strong>No bridge token detected.</strong>
        Return to Figma and relaunch the auth flow.
      </div>`
      }
      <p class="hint">
        Token completions are simulated locally for development; no external traffic is sent.
      </p>
    </main>
    <script type="module">
      const token = ${tokenForJs};
      const endpoint = ${endpointForJs};
      if (token) {
        const poll = () => {
          fetch(\`/api/figma/auth-bridge/\${encodeURIComponent(token)}?consume=1\`, { method: "GET" })
            .catch((error) => console.warn("[DevAuthPortal] Poll failed", error));
        };
        poll();
        setInterval(poll, ${currentPollIntervalMs});
        console.info("[DevAuthPortal] Active bridge token", { tokenSuffix: token.slice(-6), endpoint });
      } else {
        console.warn("[DevAuthPortal] No bridge token found in URL.");
      }
    </script>
  </body>
</html>`;
}
