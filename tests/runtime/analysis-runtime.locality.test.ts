import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PluginToUiMessage } from "../../src/types/messages";

function createChannels() {
  return {
    analysis: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    selection: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    network: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  };
}

describe("createAnalysisRuntime local endpoint detection", () => {
  let originalUrl: typeof globalThis.URL;
  let originalFigma: typeof globalThis.figma | undefined;
  let notifyUI: ReturnType<typeof vi.fn<(message: PluginToUiMessage) => void>>;
  let clientStorageData: Record<string, unknown>;

  beforeEach(() => {
    vi.resetModules();
    originalUrl = globalThis.URL;
    originalFigma = globalThis.figma;
    notifyUI = vi.fn();
    clientStorageData = {};

    (globalThis as unknown as { figma: typeof globalThis.figma }).figma = {
      currentPage: {
        selection: []
      },
      ui: { postMessage: vi.fn() },
      notify: vi.fn(),
      clientStorage: {
        getAsync: vi.fn(async (key: string) => clientStorageData[key]),
        setAsync: vi.fn(async (key: string, value: unknown) => {
          clientStorageData[key] = value;
        })
      }
    } as unknown as typeof globalThis.figma;
  });

  afterEach(() => {
    if (typeof originalUrl === "function") {
      globalThis.URL = originalUrl;
    } else if (originalUrl === undefined) {
      delete (globalThis as Record<string, unknown>).URL;
    }

    if (originalFigma) {
      globalThis.figma = originalFigma;
    } else {
      delete (globalThis as Record<string, unknown>).figma;
    }
  });

  it("leaves local accounts anonymous when URL parsing is available", async () => {
    globalThis.URL = originalUrl;
    const { createAnalysisRuntime } = await import("../../src/runtime/analysisRuntime");
    const runtime = createAnalysisRuntime({
      analysisEndpoint: "http://localhost:3115/api/analyze",
      promptVersion: "3.4.2",
      authPortalUrl: "http://localhost:3115/auth",
      notifyUI,
      channels: createChannels()
    });

    await runtime.handleAuthPortalOpened({ portalOpened: true });

    const statusCalls = notifyUI.mock.calls.filter(
      ([message]) => message.type === "SELECTION_STATUS"
    );
    expect(statusCalls.length).toBeGreaterThan(0);
    const latestStatus = statusCalls.at(-1)?.[0];
    expect(latestStatus?.payload?.credits?.accountStatus).toBe("anonymous");
  });

  it("keeps local accounts anonymous when the URL global is unavailable", async () => {
    (globalThis as Record<string, unknown>).URL = undefined;
    const { createAnalysisRuntime } = await import("../../src/runtime/analysisRuntime");
    const runtime = createAnalysisRuntime({
      analysisEndpoint: "http://localhost:3115/api/analyze",
      promptVersion: "3.4.2",
      authPortalUrl: "http://localhost:3115/auth",
      notifyUI,
      channels: createChannels()
    });

    await runtime.handleAuthPortalOpened({ portalOpened: true });

    const statusCalls = notifyUI.mock.calls.filter(
      ([message]) => message.type === "SELECTION_STATUS"
    );
    expect(statusCalls.length).toBeGreaterThan(0);
    const latestStatus = statusCalls.at(-1)?.[0];
    expect(latestStatus?.payload?.credits?.accountStatus).toBe("anonymous");
  });
});
