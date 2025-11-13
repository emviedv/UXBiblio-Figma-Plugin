import assert from "node:assert/strict";
import test from "node:test";
import { proxyUpstreamRequest } from "../upstream-proxy.mjs";

const ORIGINAL_FETCH = globalThis.fetch;

function createMockResponse({ status = 200, headers = new Headers(), body = "" } = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers,
    async arrayBuffer() {
      return new TextEncoder().encode(body).buffer;
    }
  };
}

test("proxyUpstreamRequest forwards response buffers and headers", async (t) => {
  const receivedInit = [];
  const mockHeaders = new Headers();
  mockHeaders.set("content-type", "text/html");
  mockHeaders.append("set-cookie", "session_id=abc123; Path=/");
  mockHeaders.append("set-cookie", "uxb_csrf=token987; Path=/");

  globalThis.fetch = async (url, init) => {
    receivedInit.push({ url, init });
    return createMockResponse({
      status: 201,
      headers: new Map(mockHeaders),
      body: "<html>ok</html>"
    });
  };

  await t.test(async () => {
    const result = await proxyUpstreamRequest({
      targetUrl: "https://example.com/auth",
      method: "GET",
      headers: {
        accept: "text/html",
        cookie: "foo=bar"
      }
    });

    assert.equal(result.status, 201);
    assert.equal(result.ok, true);
    assert.equal(result.body.toString("utf8"), "<html>ok</html>");
    assert.equal(result.headers.get("content-type"), "text/html");
    assert.equal(receivedInit[0].init.method, "GET");
    assert.equal(receivedInit[0].init.headers.accept, "text/html");
    assert.equal(receivedInit[0].init.headers.cookie, "foo=bar");
  });
});

test.after(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});
