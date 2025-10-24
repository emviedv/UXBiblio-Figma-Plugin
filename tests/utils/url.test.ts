import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractHostname, isLocalHostname } from "../../src/utils/url";

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
    const resolution = extractHostname("https://api.uxbiblio.com/api/analyze");
    expect(resolution?.hostname).toBe("api.uxbiblio.com");
    expect(resolution?.source).toBe("native");
  });

  it("falls back to regex parsing when URL is unavailable", () => {
    (globalThis as Record<string, unknown>).URL = undefined;
    const resolution = extractHostname("http://localhost:3115/api/analyze");
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

  it("normalizes native hostname values that incorrectly include the port", () => {
    const NativeUrl = originalUrl;
    class PortPreservingUrl {
      hostname: string;
      port: string;

      constructor(input: string) {
        const parsed = new NativeUrl(input);
        this.port = parsed.port;
        this.hostname = `${parsed.hostname}:${parsed.port}`;
      }
    }

    (globalThis as Record<string, unknown>).URL = PortPreservingUrl as unknown as typeof URL;
    const resolution = extractHostname("http://localhost:4292/api/analyze");
    expect(resolution?.hostname).toBe("localhost");
    expect(resolution?.source).toBe("native");
  });
});

describe("isLocalHostname", () => {
  it("treats localhost variants with port suffixes as local", () => {
    expect(isLocalHostname("localhost:4292")).toBe(true);
    expect(isLocalHostname("127.0.0.1:8080")).toBe(true);
  });

  it("recognises IPv6 loopback hostnames with or without brackets", () => {
    expect(isLocalHostname("::1")).toBe(true);
    expect(isLocalHostname("[::1]")).toBe(true);
  });

  it("returns false for remote hostnames", () => {
    expect(isLocalHostname("api.uxbiblio.com")).toBe(false);
    expect(isLocalHostname("192.168.5.10")).toBe(false);
  });
});
