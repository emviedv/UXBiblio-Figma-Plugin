const DEFAULT_JSON_HEADER = "application/json";

function normalizeBaseUrl(rawBase) {
  if (typeof rawBase !== "string" || rawBase.trim().length === 0) {
    throw new Error("Invalid upstream URL: value is empty");
  }

  try {
    const parsed = new URL(rawBase.trim());
    parsed.search = "";
    parsed.hash = "";
    // Preserve scoped sub-paths so teams can mount the API under proxies (e.g. /api/dev).
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    const normalized = parsed.toString().replace(/\/+$/, "");
    return normalized.length > 0 ? normalized : `${parsed.origin}`;
  } catch (error) {
    throw new Error(
      `Invalid upstream URL: ${(error instanceof Error ? error.message : String(error)) || "parse failure"}`
    );
  }
}

function normalizeHeaders(input) {
  if (!input) {
    return [];
  }

  if (typeof Headers !== "undefined" && input instanceof Headers) {
    return Array.from(input.entries());
  }

  if (Array.isArray(input)) {
    return input.map(([key, value]) => [String(key), String(value)]);
  }

  return Object.entries(input).map(([key, value]) => [String(key), String(value)]);
}

function sanitizeForwardHeaders(rawHeaders) {
  const sanitized = {};
  const forbidden = new Set(["origin", "referer", "content-length", "host"]);

  for (const [key, value] of normalizeHeaders(rawHeaders)) {
    const lower = key.toLowerCase();
    if (forbidden.has(lower)) {
      continue;
    }
    sanitized[lower] = value;
  }

  if (!("content-type" in sanitized)) {
    sanitized["content-type"] = DEFAULT_JSON_HEADER;
  }

  return sanitized;
}

function resolveBody(payload) {
  if (typeof payload === "undefined" || payload === null) {
    return undefined;
  }
  return typeof payload === "string" ? payload : JSON.stringify(payload);
}

function parseResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.toLowerCase().includes("application/json");

  if (isJson) {
    return response.json();
  }

  return response.text();
}

export function buildUpstreamTargets(rawBase) {
  const normalizedBase = normalizeBaseUrl(rawBase);
  const baseUrl = new URL(normalizedBase.endsWith("/") ? normalizedBase : `${normalizedBase}/`);

  const build = (path) => new URL(path, baseUrl);

  return {
    base: normalizedBase,
    analysis: build("/api/analyze"),
    authPortal: build("/auth"),
    createBridge: build("/api/figma/auth-bridge"),
    csrf: build("/api/csrf"),
    pollBridge: (token) => build(`/api/figma/auth-bridge/${encodeURIComponent(token)}`)
  };
}

export async function proxyJsonRequest({
  fetchImpl,
  targetUrl,
  payload,
  headers,
  method = "POST",
  signal
}) {
  const fetchFn = typeof fetchImpl === "function" ? fetchImpl : globalThis.fetch;

  if (typeof fetchFn !== "function") {
    throw new Error("Fetch implementation not available for proxy request.");
  }

  const normalizedHeaders = sanitizeForwardHeaders(headers);
  const body = resolveBody(payload);

  const response = await fetchFn(targetUrl, {
    method,
    headers: normalizedHeaders,
    body,
    signal
  });

  const bodyPayload = await parseResponseBody(response).catch(() => null);

  return {
    status: response.status,
    ok: response.ok,
    headers: response.headers,
    body: bodyPayload
  };
}

export function stripBridgeTokenParam(candidate) {
  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    return "";
  }

  try {
    const url = new URL(candidate);
    url.searchParams.delete("figmaBridgeToken");
    return url.toString();
  } catch {
    return candidate;
  }
}

export function appendBridgeToken(base, token) {
  if (typeof base !== "string" || base.trim().length === 0) {
    return "";
  }

  if (!token || typeof token !== "string") {
    return stripBridgeTokenParam(base);
  }

  try {
    const url = new URL(base);
    url.searchParams.delete("figmaBridgeToken");
    url.searchParams.set("figmaBridgeToken", token);
    return url.toString();
  } catch {
    const [beforeHash, hash = ""] = base.split("#", 2);
    const separator = beforeHash.includes("?") ? "&" : "?";
    const appended = `${beforeHash}${separator}figmaBridgeToken=${encodeURIComponent(token)}`;
    return hash ? `${appended}#${hash}` : appended;
  }
}
