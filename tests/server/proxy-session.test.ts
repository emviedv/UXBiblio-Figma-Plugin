import { beforeEach, describe, expect, it } from "vitest";

import {
  applySessionHeaders,
  clearSessions,
  getSessionSnapshot,
  recordSessionCookiesFromHeaders,
  resolveSessionId,
  storeSessionCsrfToken
} from "../../server/proxy-session.mjs";

describe("proxy session manager", () => {
  beforeEach(() => {
    clearSessions();
  });

  it("captures upstream cookies and exposes them via the session header builder", () => {
    const sessionId = resolveSessionId(undefined);

    recordSessionCookiesFromHeaders(sessionId, {
      getSetCookie: () => ["foo=bar; Path=/", "uxb_csrf=token123; Path=/"]
    });

    const { headers, csrfAttached } = applySessionHeaders(
      sessionId,
      { "content-type": "application/json" },
      { includeCsrf: true }
    );

    expect(headers.cookie).toContain("foo=bar");
    expect(headers.cookie).toContain("uxb_csrf=token123");
    expect(headers["x-csrf-token"]).toBe("token123");
    expect(csrfAttached).toBe(true);
  });

  it("stores explicit CSRF tokens even without a cookie", () => {
    const sessionId = resolveSessionId("plugin-123");

    storeSessionCsrfToken(sessionId, "manual-token");
    const { headers, csrfAttached } = applySessionHeaders(
      sessionId,
      {},
      { includeCsrf: true }
    );

    expect(headers["x-csrf-token"]).toBe("manual-token");
    expect(csrfAttached).toBe(true);
  });

  it("tracks session metadata for debug logging", () => {
    const sessionId = resolveSessionId(["   custom   "]);
    let snapshot = getSessionSnapshot(sessionId);
    expect(snapshot.sessionKey).toBe("custom");
    expect(snapshot.cookieCount).toBe(0);
    expect(snapshot.hasCsrfToken).toBe(false);

    recordSessionCookiesFromHeaders(sessionId, {
      getSetCookie: () => ["alpha=one; Path=/"]
    });

    storeSessionCsrfToken(sessionId, "csrf-abc");

    snapshot = getSessionSnapshot(sessionId);
    expect(snapshot.cookieCount).toBe(1);
    expect(snapshot.hasCsrfToken).toBe(true);
  });
});
