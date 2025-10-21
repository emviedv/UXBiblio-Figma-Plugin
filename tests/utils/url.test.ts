import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractHostname } from "../../src/utils/url";

describe("extractHostname", () => {
  let originalUrl: typeof globalThis.URL;

  beforeEach(() => {
    vi.resetModules();
    originalUrl = globalThis.URL;
  });

  afterEach(() => {
    if (typeof originalUrl === "function") {
      globalThis.URL = originalUrl;
    } else if (originalUrl === undefined) {
      delete (globalThis as Record<string, unknown>).URL;
    }
  });

  it("returns native hostname when URL is available", () => {
    const resolution = extractHostname("https://api.uxbiblio.com/api/analyze/figma");
    expect(resolution?.hostname).toBe("api.uxbiblio.com");
    expect(resolution?.source).toBe("native");
  });

  it("falls back to regex parsing when URL is unavailable", () => {
    (globalThis as Record<string, unknown>).URL = undefined;
    const resolution = extractHostname("http://localhost:4292/api/analyze/figma");
    expect(resolution?.hostname).toBe("localhost");
    expect(resolution?.source).toBe("fallback");
  });

  it("handles credentials, custom ports, and IPv6 addresses", () => {
    (globalThis as Record<string, unknown>).URL = undefined;
    const credentialed = extractHostname("https://user:pass@staging.local:8443/dashboard");
    expect(credentialed?.hostname).toBe("staging.local");
    expect(credentialed?.source).toBe("fallback");

    const ipv6 = extractHostname("https://[::1]:3115/auth");
    expect(ipv6?.hostname).toBe("::1");
    expect(ipv6?.source).toBe("fallback");
  });
});
