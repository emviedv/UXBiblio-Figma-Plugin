const DEFAULT_BASE_URL = "https://api.uxbiblio.com";
const LOCAL_FALLBACK_BASE_URL = "http://localhost:4292";

export function buildAnalysisEndpoint(baseUrl?: string): string {
  const sanitizedInput = typeof baseUrl === "string" ? baseUrl.trim() : "";
  const preferredBase = sanitizedInput.length > 0 ? sanitizedInput : getDefaultBase();
  const withScheme = ensureScheme(preferredBase);
  const trimmed = withScheme.replace(/\/+$/, "");
  const normalized = trimmed.length > 0 ? trimmed : DEFAULT_BASE_URL;

  if (typeof URL !== "function") {
    return `${normalized}/api/analyze`;
  }

  try {
    // Validate the URL so we do not emit malformed endpoints that break fetch or ping checks.
    const validated = new URL(normalized);
    validated.pathname = "/api/analyze";
    validated.search = "";
    validated.hash = "";
    return validated.toString();
  } catch {
    const fallbackBase = ensureScheme(getDefaultBase()).replace(/\/+$/, "");
    return `${fallbackBase}/api/analyze`;
  }
}

function getDefaultBase(): string {
  // Prefer the local analysis proxy during development so engineers do not accidentally hit prod.
  const nodeEnv = getNodeEnv();
  if (nodeEnv && nodeEnv !== "production") {
    return LOCAL_FALLBACK_BASE_URL;
  }

  return DEFAULT_BASE_URL;
}

function getNodeEnv(): string | undefined {
  if (typeof globalThis !== "object" || globalThis === null) {
    return undefined;
  }

  const maybeProcess = (globalThis as {
    process?: { env?: Record<string, string | undefined> };
  }).process;

  return maybeProcess?.env?.NODE_ENV;
}

function ensureScheme(base: string): string {
  if (/^https?:\/\//i.test(base)) {
    return base;
  }

  const lowercase = base.toLowerCase();
  const isLocal =
    lowercase.startsWith("localhost") ||
    lowercase.startsWith("127.") ||
    lowercase.startsWith("[::1]");

  const protocol = isLocal ? "http" : "https";
  return `${protocol}://${base}`;
}
