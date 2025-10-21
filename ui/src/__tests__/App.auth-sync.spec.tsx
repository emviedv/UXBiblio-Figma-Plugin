import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { act, cleanupApp, renderApp, tick, dispatchPluginMessage } from "../../../tests/ui/testHarness";

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

    const postMessageSpy = window.parent.postMessage as Mock;
    postMessageSpy.mockClear(); // discard UI_READY handshake

    dispatchAuthPortalMessage({ type: "uxbiblio:auth-status", status: "pro" });
    await tick();

    expect(postMessageSpy).toHaveBeenCalledWith(
      { pluginMessage: { type: "SYNC_ACCOUNT_STATUS", payload: { status: "pro" } } },
      "*"
    );
  });

  it("requests account status sync when the auth portal nests status under payload", async () => {
    renderApp();
    await tick();

    const postMessageSpy = window.parent.postMessage as Mock;
    postMessageSpy.mockClear();

    dispatchAuthPortalMessage({ type: "uxbiblio:auth-status", payload: { status: "trial" } });
    await tick();

    expect(postMessageSpy).toHaveBeenCalledWith(
      { pluginMessage: { type: "SYNC_ACCOUNT_STATUS", payload: { status: "trial" } } },
      "*"
    );
  });

  it("delegates auth portal launch to the runtime even when a URL is provided", async () => {
    renderApp();
    await tick();

    const openSpy = vi.spyOn(window, "open").mockReturnValue({} as Window);
    const postMessageSpy = window.parent.postMessage as Mock;
    postMessageSpy.mockClear();

    dispatchPluginMessage({
      type: "SELECTION_STATUS",
      payload: {
        hasSelection: false,
        credits: {
          totalFreeCredits: 0,
          remainingFreeCredits: 0,
          accountStatus: "anonymous"
        },
        authPortalUrl: "https://uxbiblio.com/auth"
      }
    } as unknown as Parameters<typeof dispatchPluginMessage>[0]);
    await tick();

    const authButton = document.querySelector(".header-auth-link") as HTMLButtonElement;
    expect(authButton).toBeTruthy();

    act(() => {
      authButton.click();
    });

    expect(openSpy).not.toHaveBeenCalled();
    expect(postMessageSpy).toHaveBeenCalledWith(
      { pluginMessage: { type: "OPEN_AUTH_PORTAL", payload: { openedByUi: false } } },
      "*"
    );

    openSpy.mockRestore();
  });

  it("normalizes deeply nested plan slugs to pro", async () => {
    renderApp();
    await tick();

    const postMessageSpy = window.parent.postMessage as Mock;
    postMessageSpy.mockClear();

    dispatchAuthPortalMessage({
      source: "uxbiblio:auth:portal",
      payload: {
        data: {
          attributes: {
            planSlug: "professional-monthly"
          }
        }
      }
    });
    await tick();

    expect(postMessageSpy).toHaveBeenCalledWith(
      { pluginMessage: { type: "SYNC_ACCOUNT_STATUS", payload: { status: "pro" } } },
      "*"
    );
  });

  it("maps free trial variants to trial status", async () => {
    renderApp();
    await tick();

    const postMessageSpy = window.parent.postMessage as Mock;
    postMessageSpy.mockClear();

    dispatchAuthPortalMessage({
      namespace: "uxbiblio:auth",
      payload: {
        meta: {
          subscription: "free_trialing"
        }
      }
    });
    await tick();

    expect(postMessageSpy).toHaveBeenCalledWith(
      { pluginMessage: { type: "SYNC_ACCOUNT_STATUS", payload: { status: "trial" } } },
      "*"
    );
  });
});
