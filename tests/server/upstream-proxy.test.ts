import { describe, expect, it, vi } from "vitest";

import {
  buildUpstreamTargets,
  proxyJsonRequest
} from "../../server/upstream-proxy.mjs";

describe("buildUpstreamTargets", () => {
  it("normalizes the upstream base URL and exposes key endpoints", () => {
    const targets = buildUpstreamTargets("http://localhost:4111/");

    expect(targets.base).toBe("http://localhost:4111");
    expect(targets.analysis.toString()).toBe("http://localhost:4111/api/analyze");
    expect(targets.authPortal.toString()).toBe("http://localhost:4111/auth");
    expect(targets.createBridge.toString()).toBe("http://localhost:4111/api/figma/auth-bridge");
    expect(targets.csrf.toString()).toBe("http://localhost:4111/api/csrf");
    expect(targets.pollBridge("token-123").toString()).toBe(
      "http://localhost:4111/api/figma/auth-bridge/token-123"
    );
  });

  it("throws when the upstream base is not a valid URL", () => {
    expect(() => buildUpstreamTargets("not-a-url")).toThrow(/Invalid upstream URL/i);
  });
});

describe("proxyJsonRequest", () => {
  it("forwards JSON payloads to the upstream endpoint", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { "content-type": "application/json" }
      });
    });

    const result = await proxyJsonRequest({
      fetchImpl: fetchMock,
      targetUrl: "http://localhost:4111/api/analyze",
      payload: { hello: "world" },
      headers: {
        "content-type": "application/json",
        "x-trace-id": "abc123",
        origin: "https://www.figma.com"
      }
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://localhost:4111/api/analyze");
    expect(init).toMatchObject({
      method: "POST",
      body: JSON.stringify({ hello: "world" })
    });
    expect((init as RequestInit).headers).toMatchObject({
      "content-type": "application/json",
      "x-trace-id": "abc123"
    });
    expect((init as RequestInit).headers).not.toHaveProperty("origin");

    expect(result.status).toBe(201);
    expect(result.body).toEqual({ ok: true });
  });

  it("surfaces upstream error payloads", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ code: "CSRF_ORIGIN_DENIED" }), {
        status: 403,
        headers: { "content-type": "application/json" }
      });
    });

    const result = await proxyJsonRequest({
      fetchImpl: fetchMock,
      targetUrl: "http://localhost:4111/api/analyze",
      payload: { hello: "world" },
      headers: { origin: "https://www.figma.com" }
    });

    expect(result.status).toBe(403);
    expect(result.body).toEqual({ code: "CSRF_ORIGIN_DENIED" });
  });
});
