import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UiToPluginMessage } from "../../../src/types/messages";

const exportSelectionToBase64Mock = vi.fn();
const sendAnalysisRequestMock = vi.fn();
const prepareAnalysisPayloadMock = vi.fn((response: unknown) => response);
const buildAnalysisEndpointMock = vi.fn(() => "https://analysis.local/api/analyze");

vi.mock("../../../src/utils/export", () => ({
  exportSelectionToBase64: exportSelectionToBase64Mock
}));
vi.mock("../../../src/utils/analysis", () => ({
  sendAnalysisRequest: sendAnalysisRequestMock
}));
vi.mock("../../../src/utils/analysis-payload", () => ({
  prepareAnalysisPayload: prepareAnalysisPayloadMock
}));
vi.mock("../../../src/services/debug-service", () => ({
  debugService: {
    forContext: () => ({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }),
    isEnabled: () => false
  }
}));
vi.mock("../../../src/utils/endpoints", () => ({
  buildAnalysisEndpoint: buildAnalysisEndpointMock
}));

type FigmaStub = ReturnType<typeof createFigmaStub>;
let figmaStub: FigmaStub;
const originalAbort = globalThis.AbortController;

function createFigmaStub() {
  let handler: ((msg: UiToPluginMessage) => void) | undefined;

  const stub = {
    showUI: vi.fn(),
    on: vi.fn(),
    notify: vi.fn(),
    currentPage: { selection: [] as any[] },
    ui: {
      postMessage: vi.fn(),
      get onmessage() {
        return handler;
      },
      set onmessage(cb) {
        handler = cb;
      }
    },
    dispatch(msg: UiToPluginMessage) {
      if (!handler) throw new Error("UI handler not registered");
      handler(msg);
    }
  };

  return stub;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.resetModules();
  figmaStub = createFigmaStub();
  (globalThis as any).figma = figmaStub;
  (globalThis as any).__UI_HTML__ = "<div></div>";
  (globalThis as any).__ANALYSIS_BASE_URL__ = "https://analysis.local/api/analyze";
  global.fetch = vi.fn();
  exportSelectionToBase64Mock.mockReset();
  sendAnalysisRequestMock.mockReset();
  prepareAnalysisPayloadMock.mockReset();
  buildAnalysisEndpointMock.mockClear();
});

afterEach(() => {
  delete (globalThis as any).figma;
  delete (globalThis as any).__UI_HTML__;
  delete (globalThis as any).__ANALYSIS_BASE_URL__;
  global.fetch = undefined as unknown as typeof fetch;
  if (originalAbort) {
    global.AbortController = originalAbort;
  }
  vi.restoreAllMocks();
});

it("rejects analyze requests when no exportable node is selected", async () => {
  figmaStub.currentPage.selection = [{ id: "1", type: "TEXT", name: "Copy" }];

  await import("../../../src/main.ts");

  figmaStub.dispatch({ type: "ANALYZE_SELECTION" });

  const lastCall = figmaStub.ui.postMessage.mock.calls.at(-1)?.[0];
  expect(lastCall).toEqual({
    type: "ANALYSIS_ERROR",
    error: "Please select a Frame or Group before analyzing."
  });
});

it("reports ping connectivity results to the UI", async () => {
  const okResponse = { ok: true, status: 200 } as Response;
  (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(okResponse);

  await import("../../../src/main.ts");

  figmaStub.dispatch({ type: "PING_CONNECTION" });

  await Promise.resolve();

  expect(fetch).toHaveBeenCalledWith("https://analysis.local/health", { method: "GET" });
  expect(figmaStub.ui.postMessage).toHaveBeenCalledWith({
    type: "PING_RESULT",
    payload: { ok: true, endpoint: "https://analysis.local/health" }
  });
});

it("aborts in-flight analyses and notifies cancellation exactly once", async () => {
  const controllers: Array<{ abort: ReturnType<typeof vi.fn>; signal: { aborted: boolean } }> = [];
  const AbortControllerMock = vi.fn(() => {
    const controller = {
      abort: vi.fn(function thisAbort() {
        controller.signal.aborted = true;
      }),
      signal: { aborted: false }
    };
    controllers.push(controller);
    return controller;
  });
  global.AbortController = AbortControllerMock as unknown as typeof AbortController;

  figmaStub.currentPage.selection = [
    {
      id: "42",
      type: "FRAME",
      name: "Hero",
      exportAsync: vi.fn().mockResolvedValue(new Uint8Array())
    }
  ];

  exportSelectionToBase64Mock.mockResolvedValue("base64-data");
  const deferred = createDeferred<any>();
  sendAnalysisRequestMock.mockImplementation(() => deferred.promise);
  prepareAnalysisPayloadMock.mockImplementation((response) => ({
    selectionName: "Hero",
    exportedAt: new Date().toISOString(),
    analysis: response
  }));

  await import("../../../src/main.ts");

  figmaStub.dispatch({ type: "ANALYZE_SELECTION" });
  await Promise.resolve();

  figmaStub.dispatch({ type: "CANCEL_ANALYSIS" });
  expect(controllers).toHaveLength(1);
  expect(controllers[0].signal.aborted).toBe(true);

  deferred.resolve({ summary: [] });
  await Promise.resolve();

  const cancellationMessages = figmaStub.ui.postMessage.mock.calls.filter(
    ([message]) => message.type === "ANALYSIS_CANCELLED"
  );
  expect(cancellationMessages).toHaveLength(1);
  expect(cancellationMessages[0][0]).toEqual({
    type: "ANALYSIS_CANCELLED",
    payload: { selectionName: "Hero" }
  });
});
