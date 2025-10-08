#!/usr/bin/env node
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { URL, fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { ENHANCED_ANALYSIS_SYSTEM_PROMPT } from "./enhanced-analysis-prompt.mjs";

bootstrapEnv();

const PORT = Number.parseInt(process.env.PORT ?? "4292", 10);
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini-2024-07-18";
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const DEBUG_REQUEST_LOGS = /^true$/i.test(process.env.UXBIBLIO_DEBUG_SERVER ?? "true");

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
    sendJson(res, 400, { error: "Invalid JSON body", details: String(error) });
    return;
  }

  const image = typeof payload?.image === "string" ? payload.image : "";
  const selectionName =
    typeof payload?.selectionName === "string" && payload.selectionName.trim().length > 0
      ? payload.selectionName.trim()
      : "Unnamed selection";

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
      sendJson(res, response.status, {
        error: "OpenAI request failed",
        details: result
      });
      return;
    }

    const content = result.choices?.[0]?.message?.content;
    let structured;

    if (typeof content === "string") {
      try {
        structured = JSON.parse(content);
      } catch (error) {
        serverLogger.warn("Failed to parse assistant JSON response");
      }
    } else if (Array.isArray(content)) {
      // Some models return an array of content parts; try to find text.
      const textPart = content.find((part) => part?.type === "text");
      if (textPart?.text) {
        try {
          structured = JSON.parse(textPart.text);
        } catch (error) {
          serverLogger.warn("Failed to parse assistant JSON from content array");
        }
      }
    }

    const analysis =
      structured && typeof structured === "object"
        ? structured
        : {
            heuristics: [],
            accessibility: [],
            psychology: [],
            impact: [],
            recommendations: []
          };

    if (analysis === structured) {
      serverLogger.info("Structured analysis parsed successfully", {
        keys: Object.keys(analysis)
      });
    } else {
      serverLogger.warn("Structured analysis missing; falling back to empty payload");
    }

    sendJson(res, 200, {
      selectionName,
      analysis,
      metadata: {
        model: result.model,
        created: result.created,
        usage: result.usage,
        raw: analysis === structured ? undefined : content
      }
    });
  } catch (error) {
    serverLogger.error("Unexpected server error", error);
    sendJson(res, 500, {
      error: "Unexpected server error",
      details: String(error)
    });
  }
}

const server = createServer(async (req, res) => {
  serverLogger.info("Incoming request", {
    method: req.method,
    url: req.url,
    headers: maskHeaders(req.headers)
  });

  const requestUrl = req.url ? new URL(req.url, `http://${req.headers.host}`) : null;
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
});

function maskHeaders(headers) {
  const masked = { ...headers };

  if (masked.authorization) {
    masked.authorization = "[masked]";
  }

  return masked;
}

server.listen(PORT, () => {
  console.log(`[server] UXBiblio analysis proxy listening on http://localhost:${PORT}`);
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
