const CSRF_COOKIE_NAME = "uxb_csrf";
const DEFAULT_SESSION_ID = "default";

const sessionStore = new Map();

function normalizeSessionId(candidate) {
  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate.trim();
  }

  return DEFAULT_SESSION_ID;
}

function getOrCreateSession(sessionId) {
  const key = normalizeSessionId(sessionId);
  let session = sessionStore.get(key);
  if (!session) {
    session = {
      cookies: new Map(),
      csrfToken: null
    };
    sessionStore.set(key, session);
  }
  return { key, session };
}

function parseSetCookieHeader(value) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  const [pair] = value.split(";", 1);
  if (!pair) {
    return null;
  }

  const eqIndex = pair.indexOf("=");
  if (eqIndex <= 0) {
    return null;
  }

  const name = pair.slice(0, eqIndex).trim();
  const cookieValue = pair.slice(eqIndex + 1).trim();
  if (!name) {
    return null;
  }

  return { name, value: cookieValue };
}

function collectSetCookie(headers) {
  if (!headers) {
    return [];
  }

  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const direct =
    headers["set-cookie"] ??
    headers["Set-Cookie"] ??
    (typeof headers.get === "function" ? headers.get("set-cookie") : undefined);

  if (!direct) {
    return [];
  }

  if (Array.isArray(direct)) {
    return direct;
  }

  return [direct];
}

function normalizeHeadersMap(input) {
  const normalized = {};
  if (!input || typeof input !== "object") {
    return normalized;
  }

  for (const [key, value] of Object.entries(input)) {
    if (!key) {
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length > 0) {
        normalized[key.toLowerCase()] = String(value[value.length - 1]);
      }
    } else if (typeof value === "string" || typeof value === "number") {
      normalized[key.toLowerCase()] = String(value);
    }
  }

  return normalized;
}

export function resolveSessionId(raw) {
  return normalizeSessionId(Array.isArray(raw) ? raw[0] : raw);
}

export function recordSessionCookiesFromHeaders(sessionId, headers) {
  const { key, session } = getOrCreateSession(sessionId);
  const setCookies = collectSetCookie(headers);
  if (!setCookies.length) {
    return { sessionKey: key, updated: false };
  }

  let updated = false;

  for (const candidate of setCookies) {
    const parsed = parseSetCookieHeader(candidate);
    if (!parsed) {
      continue;
    }
    session.cookies.set(parsed.name, parsed.value);
    if (parsed.name === CSRF_COOKIE_NAME) {
      session.csrfToken = parsed.value;
    }
    updated = true;
  }

  return { sessionKey: key, updated };
}

export function storeSessionCsrfToken(sessionId, token) {
  if (typeof token !== "string" || token.length === 0) {
    return;
  }
  const { session } = getOrCreateSession(sessionId);
  session.csrfToken = token;
}

export function applySessionHeaders(sessionId, baseHeaders = {}, options = {}) {
  const { key, session } = getOrCreateSession(sessionId);
  const normalized = normalizeHeadersMap(baseHeaders);
  const outgoing = { ...normalized };

  if (session.cookies.size > 0) {
    outgoing.cookie = Array.from(session.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  let csrfAttached = false;
  if (options.includeCsrf && session.csrfToken) {
    outgoing["x-csrf-token"] = session.csrfToken;
    csrfAttached = true;
  }

  return { headers: outgoing, sessionKey: key, csrfAttached };
}

export function getSessionSnapshot(sessionId) {
  const key = normalizeSessionId(sessionId);
  const session = sessionStore.get(key);
  return {
    sessionKey: key,
    cookieCount: session ? session.cookies.size : 0,
    hasCsrfToken: Boolean(session?.csrfToken)
  };
}

export function clearSessions() {
  sessionStore.clear();
}

export const __test__ = {
  CSRF_COOKIE_NAME,
  parseSetCookieHeader,
  collectSetCookie,
  normalizeSessionId
};
