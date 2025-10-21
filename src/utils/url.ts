export type HostnameSource = "native" | "fallback";

export interface HostnameResolution {
  hostname: string;
  source: HostnameSource;
}

const URL_PROTOCOL_REGEX = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;

/**
 * Attempts to extract the hostname from a URL-like string without relying on the host
 * environment to expose the WHATWG URL implementation. Falls back to a lightweight
 * parser when `globalThis.URL` is unavailable (as observed in the Figma main thread).
 */
export function extractHostname(candidate: string | undefined): HostnameResolution | null {
  if (!candidate || typeof candidate !== "string") {
    return null;
  }

  const trimmed = candidate.trim();
  if (!trimmed) {
    return null;
  }

  const nativeHostname = extractViaNativeUrl(trimmed);
  if (nativeHostname) {
    return { hostname: nativeHostname, source: "native" };
  }

  const fallbackHostname = extractViaFallback(trimmed);
  if (fallbackHostname) {
    return { hostname: fallbackHostname, source: "fallback" };
  }

  return null;
}

export function deriveApiBaseUrl(candidate: string | undefined): string | null {
  if (!candidate || typeof candidate !== "string") {
    return null;
  }

  const trimmed = candidate.trim();
  if (!trimmed) {
    return null;
  }

  if (typeof URL === "function") {
    try {
      const parsed = new URL(trimmed);
      parsed.pathname = "";
      parsed.search = "";
      parsed.hash = "";
      const normalized = parsed.toString().replace(/\/+$/, "");
      return normalized.length > 0 ? normalized : null;
    } catch {
      // Fall through to pattern-based extraction
    }
  }

  const match = trimmed.match(/^(https?:\/\/[^/?#]+)/i);
  if (match && match[1]) {
    return match[1].replace(/\/+$/, "");
  }

  return null;
}

function extractViaNativeUrl(candidate: string): string | null {
  if (typeof URL !== "function") {
    return null;
  }

  try {
    const parsed = new URL(candidate);
    return parsed.hostname;
  } catch {
    return null;
  }
}

function extractViaFallback(candidate: string): string | null {
  if (!URL_PROTOCOL_REGEX.test(candidate)) {
    return null;
  }

  const protocolSplitIndex = candidate.indexOf("://");
  const authorityWithRest = candidate.slice(protocolSplitIndex + 3);
  if (!authorityWithRest) {
    return null;
  }

  const authority = stripCredentials(authorityWithRest.split(/[/?#]/, 1)[0]);
  if (!authority) {
    return null;
  }

  if (authority.startsWith("[")) {
    const closingIndex = authority.indexOf("]");
    if (closingIndex === -1) {
      return null;
    }
    return authority.slice(1, closingIndex);
  }

  const colonIndex = authority.indexOf(":");
  return colonIndex === -1 ? authority : authority.slice(0, colonIndex);
}

function stripCredentials(authority: string): string {
  if (!authority.includes("@")) {
    return authority;
  }

  return authority.slice(authority.lastIndexOf("@") + 1);
}
