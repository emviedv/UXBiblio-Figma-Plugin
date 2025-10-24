#!/usr/bin/env node
import { createServer as createHttpsServer } from "node:https";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { URL, fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { ENHANCED_ANALYSIS_SYSTEM_PROMPT } from "./enhanced-analysis-prompt.mjs";
import { extractStructuredResponse } from "./response-parser.mjs";
import {
  createDevAuthBridgeToken,
  pollDevAuthBridgeToken,
  renderDevAuthPortalPage
} from "./auth-bridge-dev.mjs";
import { buildUpstreamTargets, proxyJsonRequest } from "./upstream-proxy.mjs";
import {
  applySessionHeaders,
  getSessionSnapshot,
  recordSessionCookiesFromHeaders,
  resolveSessionId,
  storeSessionCsrfToken
} from "./proxy-session.mjs";

bootstrapEnv();

const PORT = Number.parseInt(process.env.PORT ?? "4292", 10);
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini-2024-07-18";
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const DEBUG_REQUEST_LOGS = /^true$/i.test(process.env.UXBIBLIO_DEBUG_SERVER ?? "true");
const TLS_KEY_PATH = process.env.UXBIBLIO_TLS_KEY_PATH ?? "";
const TLS_CERT_PATH = process.env.UXBIBLIO_TLS_CERT_PATH ?? "";
const TLS_ENABLED =
  Boolean(TLS_KEY_PATH && TLS_CERT_PATH) &&
  existsSync(TLS_KEY_PATH) &&
  existsSync(TLS_CERT_PATH);
const MAX_FLOW_FRAMES = 5;
const RAW_UPSTREAM_BASE_URL = process.env.UXBIBLIO_ANALYSIS_UPSTREAM_URL
  ? process.env.UXBIBLIO_ANALYSIS_UPSTREAM_URL.trim()
  : "";
let upstreamTargets = null;
let upstreamConfigError = null;
if (RAW_UPSTREAM_BASE_URL.length > 0) {
  try {
    upstreamTargets = buildUpstreamTargets(RAW_UPSTREAM_BASE_URL);
  } catch (error) {
    upstreamConfigError = error instanceof Error ? error : new Error(String(error));
  }
}
const PROXY_MODE_ENABLED = Boolean(upstreamTargets);
const ENABLE_DEV_AUTH_BRIDGE = (() => {
  const override = process.env.UXBIBLIO_ENABLE_DEV_AUTH_BRIDGE;
  if (typeof override === "string") {
    return /^true$/i.test(override);
  }
  return process.env.NODE_ENV !== "production";
})();
const FIGMA_BRIDGE_QUERY_PARAM = "figmaBridgeToken";
const PROXY_SESSION_HEADER = "x-uxbiblio-proxy-session";

const serverLogger = {
  info(...args) {
    if (DEBUG_REQUEST_LOGS) {
      console.info("[analysis-server][INFO]", ...args);
    }
  },
  warn(...args) {
    if (DEBUG_REQUEST_LOGS) {
      console.warn("[analysis-server][WARN]", ...args);
    }
  },
  error(...args) {
    console.error("[analysis-server][ERROR]", ...args);
  }
};

if (upstreamConfigError) {
  serverLogger.error("Failed to configure upstream proxy", {
    error: upstreamConfigError.message
  });
}

if (PROXY_MODE_ENABLED && upstreamTargets) {
  serverLogger.info("Upstream proxy mode enabled", {
    upstreamBase: upstreamTargets.base,
    analysisEndpoint: upstreamTargets.analysis.toString()
  });
}

function sendJson(res, statusCode, payload, options = {}) {
  const { headers: extraHeaders = {}, cookies = [] } = options;
  const normalizedPayload =
    typeof payload === "string" ? payload : JSON.stringify(payload ?? {}, null, 2);

  const allowedHeaders = [
    "Content-Type",
    "Authorization",
    "X-UXBiblio-Proxy-Session",
    "X-CSRF-Token"
  ].join(", ");

  const baseHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": allowedHeaders,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
  };

  const mergedHeaders = { ...baseHeaders, ...extraHeaders };

  if (Array.isArray(cookies) && cookies.length > 0) {
    mergedHeaders["Set-Cookie"] = cookies.length === 1 ? cookies[0] : cookies;
  }

  res.writeHead(statusCode, mergedHeaders);
  res.end(normalizedPayload);
}

function logProxySession(event, sessionId, data = {}) {
  if (!DEBUG_REQUEST_LOGS) {
    return;
  }

  const snapshot = getSessionSnapshot(sessionId);
  serverLogger.info("[DEBUG_FIX][ProxySession]", {
    event,
    sessionId: snapshot.sessionKey,
    cookieCount: snapshot.cookieCount,
    hasCsrfToken: snapshot.hasCsrfToken,
    ...data
  });
}

function getSetCookieList(headers) {
  if (!headers) {
    return [];
  }

  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const value =
    headers["set-cookie"] ??
    headers["Set-Cookie"] ??
    (typeof headers.get === "function" ? headers.get("set-cookie") : undefined);

  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

async function proxyFetchCsrfToken(sessionId, reqHeaders) {
  if (!PROXY_MODE_ENABLED || !upstreamTargets?.csrf) {
    return null;
  }

  const { headers } = applySessionHeaders(sessionId, reqHeaders, { includeCsrf: false });
  headers.accept = headers.accept ?? "application/json";

  const response = await proxyJsonRequest({
    targetUrl: upstreamTargets.csrf.toString(),
    method: "GET",
    headers
  });

  recordSessionCookiesFromHeaders(sessionId, response.headers);
  const body = response.body;
  if (body && typeof body === "object" && typeof body.token === "string") {
    storeSessionCsrfToken(sessionId, body.token);
  }

  logProxySession("csrf-proxy", sessionId, { status: response.status });

  return response;
}

async function ensureProxyCsrfToken(sessionId, reqHeaders) {
  if (!PROXY_MODE_ENABLED || !upstreamTargets?.csrf) {
    return;
  }

  const snapshot = getSessionSnapshot(sessionId);
  if (snapshot.hasCsrfToken) {
    return;
  }

  try {
    await proxyFetchCsrfToken(sessionId, reqHeaders);
  } catch (error) {
    serverLogger.warn("[DEBUG_FIX][ProxySession] Failed to refresh CSRF token", {
      sessionId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => {
      if (DEBUG_REQUEST_LOGS) {
        serverLogger.info("Streaming request chunk", {
          bytes: chunk.length,
          path: req.url,
          method: req.method
        });
      }
      chunks.push(chunk);
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.on("end", () => {
      try {
        const buffer = Buffer.concat(chunks);
        const text = buffer.toString("utf8") || "{}";
        resolve(JSON.parse(text));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function analysisEndpointFromEnv() {
  const raw =
    typeof process.env.UXBIBLIO_ANALYSIS_URL === "string"
      ? process.env.UXBIBLIO_ANALYSIS_URL.trim()
      : "";
  if (raw.length > 0) {
    return raw;
  }
  return process.env.NODE_ENV === "production"
    ? "https://api.uxbiblio.com/api/analyze"
    : "http://localhost:4292/api/analyze";
}

async function handleAnalyzeRequest(req, res) {
  serverLogger.info("Handling analyze request", {
    method: req.method,
    url: req.url,
    headers: maskHeaders(req.headers)
  });

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  let payload;

  try {
    payload = await readRequestBody(req);
  } catch (error) {
    serverLogger.warn("Failed to parse analyze request body", error);
    // Sanitize error response to avoid leaking internals
    sendJson(res, 400, { error: "Invalid JSON body" });
    return;
  }

  const selectionName =
    typeof payload?.selectionName === "string" && payload.selectionName.trim().length > 0
      ? payload.selectionName.trim()
      : "Unnamed selection";
  const metadata = payload && typeof payload === "object" ? payload.metadata : undefined;
  const palette = Array.isArray(payload?.palette) ? payload.palette : undefined;
  const framesInput = Array.isArray(payload?.frames) ? payload.frames : [];

  const normalizedFrames = framesInput
    .map((frame, idx) => {
      if (!frame || typeof frame !== "object") {
        return null;
      }

      const image = typeof frame.image === "string" ? frame.image : "";
      if (!image) {
        return null;
      }

      const frameId =
        typeof frame.frameId === "string" && frame.frameId.trim().length > 0
          ? frame.frameId.trim()
          : `frame-${idx}`;
      const frameName =
        typeof frame.frameName === "string" && frame.frameName.trim().length > 0
          ? frame.frameName.trim()
          : `Frame ${idx + 1}`;
      const frameIndex =
        typeof frame.index === "number" && Number.isFinite(frame.index)
          ? Number(frame.index)
          : idx;

      return {
        frameId,
        frameName,
        index: frameIndex,
        rawImage: image,
        imageUrl: ensureDataUri(image),
        imageLength: image.length,
        metadata: frame.metadata
      };
    })
    .filter(Boolean);

  if (!normalizedFrames.length) {
    const legacyImage = typeof payload?.image === "string" ? payload.image : "";
    if (!legacyImage) {
      sendJson(res, 400, { error: "Missing analysis frames." });
      return;
    }

    normalizedFrames.push({
      frameId: "legacy",
      frameName: selectionName,
      index: 0,
      rawImage: legacyImage,
      imageUrl: ensureDataUri(legacyImage),
      imageLength: legacyImage.length,
      metadata
    });
  }

  if (normalizedFrames.length > MAX_FLOW_FRAMES) {
    sendJson(res, 400, {
      error: `Too many frames provided. Maximum allowed is ${MAX_FLOW_FRAMES}.`
    });
    return;
  }

  serverLogger.info("Analyze request payload received", {
    selectionName,
    frameCount: normalizedFrames.length,
    frames: normalizedFrames.map((frame) => ({
      frameId: frame.frameId,
      frameName: frame.frameName,
      index: frame.index,
      imageLength: frame.imageLength
    }))
  });

  if (PROXY_MODE_ENABLED && upstreamTargets) {
    const sessionId = resolveSessionId(req.headers[PROXY_SESSION_HEADER]);
    const upstreamPayload = {
      selectionName,
      frames: normalizedFrames.map((frame) => ({
        frameId: frame.frameId,
        frameName: frame.frameName,
        index: frame.index,
        image: frame.rawImage,
        metadata: frame.metadata ?? null
      })),
      metadata: metadata ?? null,
      palette: palette ?? null,
      source: typeof payload?.source === "string" ? payload.source : "figma-plugin"
    };

    try {
      await ensureProxyCsrfToken(sessionId, req.headers);
      const { headers: forwardHeaders } = applySessionHeaders(sessionId, req.headers, {
        includeCsrf: true
      });

      serverLogger.info("Proxying analysis payload to upstream", {
        upstream: upstreamTargets.analysis.toString(),
        frameCount: upstreamPayload.frames.length,
        selectionName
      });
      logProxySession("analysis-forward", sessionId, {
        frameCount: upstreamPayload.frames.length,
        selectionName
      });

      const upstreamResponse = await proxyJsonRequest({
        targetUrl: upstreamTargets.analysis.toString(),
        payload: upstreamPayload,
        headers: forwardHeaders
      });

      recordSessionCookiesFromHeaders(sessionId, upstreamResponse.headers);
      const setCookies = getSetCookieList(upstreamResponse.headers);

      logProxySession("analysis-response", sessionId, {
        status: upstreamResponse.status,
        hasBody: Boolean(upstreamResponse.body)
      });

      sendJson(res, upstreamResponse.status, upstreamResponse.body ?? {}, {
        cookies: setCookies
      });
    } catch (error) {
      serverLogger.error("Failed to proxy analysis request upstream", {
        upstream: upstreamTargets?.analysis?.toString?.() ?? RAW_UPSTREAM_BASE_URL,
        error: error instanceof Error ? error.message : String(error)
      });
      sendJson(res, 502, { error: "Upstream analysis request failed" });
    }
    return;
  }

  if (!OPENAI_API_KEY) {
    sendJson(res, 500, {
      error: "OPENAI_API_KEY environment variable is not set.",
      hint: "Set OPENAI_API_KEY before starting the server."
    });
    return;
  }

  try {
    const frameContext = normalizedFrames.map((frame) => ({
      frameId: frame.frameId,
      frameName: frame.frameName,
      index: frame.index
    }));

    const userContent = [
      {
        type: "text",
        text: JSON.stringify(
          {
            selectionName,
            frameCount: normalizedFrames.length,
            frames: frameContext,
            metadata: metadata ?? null,
            palette: palette ?? null
          },
          null,
          0
        )
      },
      ...normalizedFrames.flatMap((frame, idx) => [
        {
          type: "text",
          text: `Frame ${idx + 1}/${normalizedFrames.length}: ${frame.frameName}`
        },
        {
          type: "image_url",
          image_url: { url: frame.imageUrl, detail: "auto" }
        }
      ])
    ];

    const response = await fetch(`${OPENAI_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: {
          type: "json_object"
        },
        messages: [
          {
            role: "system",
            content: ENHANCED_ANALYSIS_SYSTEM_PROMPT
          },
          {
            role: "user",
            content: userContent
          }
        ],
        temperature: 0.2
      })
    });

    const result = await response.json();

    serverLogger.info("OpenAI response received", {
      model: result.model,
      status: response.status,
      choices: Array.isArray(result.choices)
        ? result.choices.map((choice, index) => {
            const textContent =
              typeof choice?.message?.content === "string"
                ? choice.message.content.slice(0, 400)
                : "[non-string]";
            return { index, finishReason: choice?.finish_reason, preview: textContent };
          })
        : "[no choices]"
    });

    if (!response.ok) {
      serverLogger.error("OpenAI request failed", { status: response.status, body: result });
      // Sanitize error response; do not leak remote error payloads
      sendJson(res, response.status, {
        error: "Upstream request failed",
        status: response.status
      });
      return;
    }

    const { analysis: parsedAnalysis, raw, contentTypes } = extractStructuredResponse(result);

    if (!parsedAnalysis) {
      serverLogger.warn("Structured analysis missing; falling back to empty payload", {
        contentTypes,
        rawPreview: typeof raw === "string" ? raw.slice(0, 200) : "[no raw text]"
      });
    } else {
      serverLogger.info("Structured analysis parsed successfully", {
        keys: Object.keys(parsedAnalysis),
        contentTypes
      });
    }

    const analysis =
      parsedAnalysis && typeof parsedAnalysis === "object"
        ? parsedAnalysis
        : {
            heuristics: [],
            accessibility: [],
            psychology: [],
            impact: [],
            recommendations: []
          };

    sendJson(res, 200, {
      selectionName,
      analysis,
      metadata: {
        model: result.model,
        created: result.created,
        usage: result.usage,
        frameCount: normalizedFrames.length,
        frames: frameContext,
        request: {
          metadata: metadata ?? null,
          palette: palette ?? null
        },
        raw: parsedAnalysis ? undefined : raw
      }
    });
  } catch (error) {
    serverLogger.error("Unexpected server error", error);
    // Sanitize error response to avoid leaking internals
    sendJson(res, 500, { error: "Unexpected server error" });
  }
}
// Request handler (shared by HTTP/HTTPS)
async function requestHandler(req, res) {
  serverLogger.info("Incoming request", {
    method: req.method,
    url: req.url,
    headers: maskHeaders(req.headers)
  });

  // Reflect actual scheme for accurate URL parsing
  const scheme = req.socket && req.socket.encrypted ? "https" : "http";
  const requestUrl = req.url ? new URL(req.url, `${scheme}://${req.headers.host}`) : null;
  const path = requestUrl?.pathname ?? "";

  if (PROXY_MODE_ENABLED && upstreamTargets && path === "/auth") {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const redirectTarget = new URL(upstreamTargets.authPortal.toString());

    if (requestUrl) {
      requestUrl.searchParams.forEach((value, key) => {
        redirectTarget.searchParams.set(key, value);
      });
    }

    redirectTarget.searchParams.set("analysisEndpoint", upstreamTargets.analysis.toString());

    serverLogger.info("Redirecting auth portal request to upstream", {
      location: redirectTarget.toString()
    });

    res.writeHead(302, {
      Location: redirectTarget.toString(),
      "Access-Control-Allow-Origin": "*"
    });
    res.end();
    return;
  }

  if (!PROXY_MODE_ENABLED && ENABLE_DEV_AUTH_BRIDGE && path === "/auth") {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const token = requestUrl?.searchParams.get(FIGMA_BRIDGE_QUERY_PARAM) ?? "";
    const html = renderDevAuthPortalPage({
      token,
      analysisEndpoint: requestUrl?.searchParams.get("analysisEndpoint") ?? analysisEndpointFromEnv()
    });

    serverLogger.info("Dev auth portal served", {
      hasToken: token.length > 0,
      tokenSuffix: token.length > 6 ? token.slice(-6) : null
    });

    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    });
    res.end(html);
    return;
  }

  if (PROXY_MODE_ENABLED && upstreamTargets && path === "/api/figma/auth-bridge") {
    if (req.method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    let bridgePayload = {};
    try {
      bridgePayload = await readRequestBody(req);
    } catch (error) {
      serverLogger.warn("Failed to parse proxy auth bridge payload", error);
      sendJson(res, 400, { error: "Invalid JSON body" });
      return;
    }

    const sessionId = resolveSessionId(req.headers[PROXY_SESSION_HEADER]);

    try {
      await ensureProxyCsrfToken(sessionId, req.headers);
      const { headers: forwardHeaders } = applySessionHeaders(sessionId, req.headers, {
        includeCsrf: true
      });
      logProxySession("auth-bridge-create-forward", sessionId, {});

      const upstreamResponse = await proxyJsonRequest({
        targetUrl: upstreamTargets.createBridge.toString(),
        payload: bridgePayload,
        headers: forwardHeaders
      });

      recordSessionCookiesFromHeaders(sessionId, upstreamResponse.headers);
      const setCookies = getSetCookieList(upstreamResponse.headers);
      logProxySession("auth-bridge-create-response", sessionId, {
        status: upstreamResponse.status
      });

      sendJson(res, upstreamResponse.status, upstreamResponse.body ?? {}, {
        cookies: setCookies
      });
    } catch (error) {
      serverLogger.error("Failed to proxy auth bridge creation", {
        upstream: upstreamTargets.createBridge.toString(),
        error: error instanceof Error ? error.message : String(error)
      });
      sendJson(res, 502, { error: "Upstream auth bridge request failed" });
    }
    return;
  }

  if (!PROXY_MODE_ENABLED && ENABLE_DEV_AUTH_BRIDGE && path === "/api/figma/auth-bridge") {
    if (req.method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    let payload = {};
    try {
      payload = await readRequestBody(req);
    } catch (error) {
      serverLogger.warn("Failed to parse auth bridge create payload", error);
      sendJson(res, 400, { error: "Invalid JSON body" });
      return;
    }

    const { token, expiresAt, pollAfterMs } = createDevAuthBridgeToken({
      analysisEndpoint: payload?.analysisEndpoint
    });

    serverLogger.info("Dev auth bridge token issued", {
      tokenSuffix: token.slice(-6),
      analysisEndpoint: payload?.analysisEndpoint ?? null
    });

    sendJson(res, 201, {
      token,
      expiresAt: new Date(expiresAt).toISOString(),
      pollAfterMs
    });
    return;
  }

  if (PROXY_MODE_ENABLED && upstreamTargets) {
    const match = path.match(/^\/api\/figma\/auth-bridge\/([^/]+)$/);
    if (match) {
      if (req.method === "OPTIONS") {
        sendJson(res, 204, {});
        return;
      }

      if (req.method !== "GET") {
        sendJson(res, 405, { error: "Method not allowed" });
        return;
      }

      const token = match[1];
      const targetUrl = upstreamTargets.pollBridge(token);

      if (requestUrl) {
        requestUrl.searchParams.forEach((value, key) => {
          targetUrl.searchParams.set(key, value);
        });
      }

      const sessionId = resolveSessionId(req.headers[PROXY_SESSION_HEADER]);

      try {
        const { headers: forwardHeaders } = applySessionHeaders(sessionId, req.headers, {
          includeCsrf: true
        });
        logProxySession("auth-bridge-poll-forward", sessionId, { tokenSuffix: token.slice(-6) });

        const upstreamResponse = await proxyJsonRequest({
          targetUrl: targetUrl.toString(),
          method: "GET",
          headers: forwardHeaders
        });

        recordSessionCookiesFromHeaders(sessionId, upstreamResponse.headers);
        const setCookies = getSetCookieList(upstreamResponse.headers);
        logProxySession("auth-bridge-poll-response", sessionId, {
          status: upstreamResponse.status,
          tokenSuffix: token.slice(-6)
        });

        sendJson(res, upstreamResponse.status, upstreamResponse.body ?? {}, {
          cookies: setCookies
        });
      } catch (error) {
        serverLogger.error("Failed to proxy auth bridge poll", {
          upstream: targetUrl.toString(),
          error: error instanceof Error ? error.message : String(error)
        });
        sendJson(res, 502, { error: "Upstream auth bridge poll failed" });
      }
      return;
    }
  }

  if (!PROXY_MODE_ENABLED && ENABLE_DEV_AUTH_BRIDGE) {
    const match = path.match(/^\/api\/figma\/auth-bridge\/([^/]+)$/);
    if (match) {
      if (req.method !== "GET") {
        sendJson(res, 405, { error: "Method not allowed" });
        return;
      }

      const consumeParam = requestUrl?.searchParams.get("consume");
      const consume =
        typeof consumeParam === "string" &&
        (consumeParam === "1" || consumeParam.toLowerCase() === "true");

      const result = pollDevAuthBridgeToken(match[1], { consume });
      switch (result.type) {
        case "pending":
        case "completed": {
          sendJson(res, 200, result.response);
          break;
        }
        case "expired": {
          sendJson(res, 410, { error: "Token expired" });
          break;
        }
        case "gone": {
          sendJson(res, 410, { error: "Token already consumed" });
          break;
        }
        default: {
          sendJson(res, 404, { error: "Token not found" });
          break;
        }
      }
      return;
    }
  }

  if (PROXY_MODE_ENABLED && upstreamTargets && path === "/api/csrf") {
    if (req.method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }

    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const sessionId = resolveSessionId(req.headers[PROXY_SESSION_HEADER]);

    try {
      const upstreamResponse = await proxyFetchCsrfToken(sessionId, req.headers);
      if (!upstreamResponse) {
        sendJson(res, 502, { error: "CSRF proxy unavailable" });
        return;
      }

      const setCookies = getSetCookieList(upstreamResponse.headers);
      sendJson(res, upstreamResponse.status, upstreamResponse.body ?? {}, {
        cookies: setCookies
      });
    } catch (error) {
      serverLogger.error("Failed to proxy CSRF token request", {
        error: error instanceof Error ? error.message : String(error)
      });
      sendJson(res, 502, { error: "Upstream CSRF token request failed" });
    }
    return;
  }

  if (path === "/api/analyze" || path === "/api/analyze/figma") {
    await handleAnalyzeRequest(req, res);
    return;
  }

  if (path === "/health") {
    serverLogger.info("Health check hit", { path, port: PORT });
    sendJson(res, 200, { ok: true, model: MODEL, port: PORT });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

// Create server with HTTPS if certs are provided; otherwise fall back to HTTP (local only)
async function createServerInstance(handler) {
  if (TLS_ENABLED) {
    serverLogger.info("Starting HTTPS server", {
      keyPath: TLS_KEY_PATH,
      certPath: TLS_CERT_PATH
    });
    const httpsOptions = {
      key: readFileSync(TLS_KEY_PATH),
      cert: readFileSync(TLS_CERT_PATH)
    };
    return createHttpsServer(httpsOptions, handler);
  }

  serverLogger.warn(
    "TLS not configured; starting HTTP server for local development only"
  );
  // Use dynamic import to avoid static dependency on node:http in secure builds
  const httpMod = await import("node:" + "http");
  return httpMod.createServer(handler);
}

function maskHeaders(headers) {
  const masked = { ...headers };

  if (masked.authorization) {
    masked.authorization = "[masked]";
  }

  return masked;
}

const server = await createServerInstance(requestHandler);
server.listen(PORT, () => {
  const scheme = TLS_ENABLED ? "https" : "http";
  console.log(`[server] UXBiblio analysis proxy listening on ${scheme}://localhost:${PORT}`);
  if (!OPENAI_API_KEY) {
    console.warn("[server] OPENAI_API_KEY is not set. Requests will fail until it is provided.");
  }
});

function ensureDataUri(b64) {
  if (typeof b64 !== "string" || b64.length === 0) {
    return "";
  }
  if (b64.startsWith("data:")) {
    return b64;
  }
  return `data:image/png;base64,${b64}`;
}

function bootstrapEnv() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const projectRoot = resolve(__dirname, "..");
  const envFiles = [".env.local", ".env"];

  for (const filename of envFiles) {
    const path = resolve(projectRoot, filename);
    if (existsSync(path)) {
      loadEnv({ path, override: false });
    }
  }
}
