import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as wait } from "node:timers/promises";

import {
  createDevAuthBridgeToken,
  pollDevAuthBridgeToken,
  clearDevAuthBridgeTokens,
  setDevAuthBridgeConfig,
  resetDevAuthBridgeConfig,
  renderDevAuthPortalPage
} from "../auth-bridge-dev.mjs";

const TEST_COMPLETION_DELAY_MS = 20;
const TEST_TTL_MS = 120;
const TEST_POLL_INTERVAL_MS = 30;

test.beforeEach(() => {
  setDevAuthBridgeConfig({
    completionDelayMs: TEST_COMPLETION_DELAY_MS,
    ttlMs: TEST_TTL_MS,
    pollIntervalMs: TEST_POLL_INTERVAL_MS
  });
  clearDevAuthBridgeTokens();
});

test.afterEach(() => {
  clearDevAuthBridgeTokens();
  resetDevAuthBridgeConfig();
});

test("dev auth bridge resolves to trial after the completion delay", async () => {
  const { token, expiresAt, pollAfterMs } = createDevAuthBridgeToken({
    analysisEndpoint: "http://localhost:3115/api/analyze"
  });

  assert.ok(typeof token === "string" && token.length > 12);
  assert.ok(expiresAt > Date.now());
  assert.ok(expiresAt - Date.now() <= TEST_TTL_MS);
  assert.equal(pollAfterMs, TEST_POLL_INTERVAL_MS);

  const pending = pollDevAuthBridgeToken(token, { consume: false });
  assert.equal(pending.type, "pending");
  assert.equal(pending.response.status, "pending");

  await wait(TEST_COMPLETION_DELAY_MS + 10);

  const completed = pollDevAuthBridgeToken(token, { consume: false });
  assert.equal(completed.type, "completed");
  assert.equal(completed.response.status, "completed");
  assert.equal(completed.response.accountStatus, "trial");
  assert.equal(completed.response.payload.account.status, "trial");
});

test("dev auth bridge tokens can be consumed or expire", async () => {
  const { token } = createDevAuthBridgeToken({
    analysisEndpoint: "http://localhost:3115/api/analyze"
  });

  await wait(TEST_COMPLETION_DELAY_MS + 5);

  const consumed = pollDevAuthBridgeToken(token, { consume: true });
  assert.equal(consumed.type, "completed");
  assert.ok(typeof consumed.response.consumedAt === "string");

  const gone = pollDevAuthBridgeToken(token, { consume: true });
  assert.equal(gone.type, "gone");

  const { token: expiringToken } = createDevAuthBridgeToken({
    analysisEndpoint: "http://localhost:3115/api/analyze"
  });

  await wait(TEST_TTL_MS + 5);

  const expired = pollDevAuthBridgeToken(expiringToken, { consume: false });
  assert.equal(expired.type, "expired");
});

test("renders the dev auth portal page with sanitized token and endpoint", () => {
  const html = renderDevAuthPortalPage({
    token: 'bridge-token-123<danger>',
    analysisEndpoint: "http://localhost:3115/api/analyze"
  });

  assert.match(html, /UXBiblio Dev Auth Portal/);
  assert.match(html, /bridge token/i);
  assert.match(html, /bridge-token-123&lt;danger&gt;/);
  assert.match(html, /http:\/\/localhost:3115\/api\/analyze\/figma/);
  assert.match(html, /setInterval\(poll/);
});
