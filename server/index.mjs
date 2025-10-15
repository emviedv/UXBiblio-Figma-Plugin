#!/usr/bin/env node
import { createServer as createHttpsServer } from "node:https";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { URL, fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { ENHANCED_ANALYSIS_SYSTEM_PROMPT } from "./enhanced-analysis-prompt.mjs";
import { extractStructuredResponse } from "./response-parser.mjs";

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

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);

  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  });

  res.end(body);
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

  const image = typeof payload?.image === "string" ? payload.image : "";
  const selectionName =
    typeof payload?.selectionName === "string" && payload.selectionName.trim().length > 0
      ? payload.selectionName.trim()
      : "Unnamed selection";
  const metadata = payload && typeof payload === "object" ? payload.metadata : undefined;
  const palette = Array.isArray(payload?.palette) ? payload.palette : undefined;

  if (!image) {
    sendJson(res, 400, { error: "Missing image base64 payload." });
    return;
  }

  serverLogger.info("Analyze request payload received", {
    selectionName,
    imageLength: image.length
  });

  if (!OPENAI_API_KEY) {
    sendJson(res, 500, {
      error: "OPENAI_API_KEY environment variable is not set.",
      hint: "Set OPENAI_API_KEY before starting the server."
    });
    return;
  }

  try {
    const imageUrl = ensureDataUri(image);
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
            content: [
              // Provide compact JSON metadata/palette context when available
              ...(metadata || palette
                ? [
                    {
                      type: "text",
                      text: JSON.stringify(
                        {
                          selectionName,
                          metadata: metadata ?? null,
                          palette: palette ?? null
                        },
                        null,
                        0
                      )
                    }
                  ]
                : []),
              {
                type: "text",
                text: `Analyze the provided image for UX heuristics. Selection name: ${selectionName}.`
              },
              {
                type: "image_url",
                image_url: { url: imageUrl, detail: "auto" }
              }
            ]
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

  if (path === "/api/analyze/figma") {
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
