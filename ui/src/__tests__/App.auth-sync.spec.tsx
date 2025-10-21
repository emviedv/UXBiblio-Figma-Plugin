import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanupApp, renderApp, tick } from "../../../tests/ui/testHarness";

function dispatchAuthPortalMessage(data: Record<string, unknown>) {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data }));
  });
}

describe("App auth handshake", () => {
  beforeEach(() => {
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanupApp();
    vi.restoreAllMocks();
  });

  it("requests account status sync when the auth portal reports a paid plan", async () => {
    renderApp();
    await tick();

    const postMessageSpy = window.parent.postMessage as vi.Mock;
    postMessageSpy.mockClear(); // discard UI_READY handshake

    dispatchAuthPortalMessage({ type: "uxbiblio:auth-status", status: "pro" });
    await tick();

    expect(postMessageSpy).toHaveBeenCalledWith(
      { pluginMessage: { type: "SYNC_ACCOUNT_STATUS", payload: { status: "pro" } } },
      "*"
    );
  });
});
