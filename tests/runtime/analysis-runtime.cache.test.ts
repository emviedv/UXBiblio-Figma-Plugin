import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PluginToUiMessage } from "../../src/types/messages";

const exportSelectionToBase64Mock = vi.fn();
const sendAnalysisRequestMock = vi.fn();
const prepareAnalysisPayloadMock = vi.fn();

vi.mock("../../src/utils/export", () => ({
  exportSelectionToBase64: exportSelectionToBase64Mock
}));

vi.mock("../../src/utils/analysis", () => ({
  sendAnalysisRequest: sendAnalysisRequestMock
}));

vi.mock("../../src/utils/analysis-payload", () => ({
  prepareAnalysisPayload: prepareAnalysisPayloadMock
}));

function createChannels() {
  return {
    analysis: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    selection: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    network: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  };
}

describe("createAnalysisRuntime cache safeguards", () => {
  let originalFigma: typeof globalThis.figma | undefined;
  let notifyUI: ReturnType<typeof vi.fn<(message: PluginToUiMessage) => void>>;
  let clientStorageData: Record<string, unknown>;

  beforeEach(async () => {
    vi.resetModules();

    exportSelectionToBase64Mock.mockResolvedValue("data:image/png;base64,AAA=");
    sendAnalysisRequestMock.mockReset();
    prepareAnalysisPayloadMock.mockImplementation((response: unknown, context: { selectionName: string; exportedAt: string }) => ({
      selectionName: context.selectionName,
      exportedAt: context.exportedAt,
      analysis: response,
      metadata: undefined
    }));

    notifyUI = vi.fn();
    originalFigma = globalThis.figma;
    clientStorageData = {};

    (globalThis as unknown as { figma: typeof globalThis.figma }).figma = {
      currentPage: {
        selection: [
          {
            id: "123",
            name: "Hero Frame",
            type: "FRAME",
            exportAsync: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
            version: 7,
            width: 800,
            height: 600
          }
        ]
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
    exportSelectionToBase64Mock.mockReset();
    prepareAnalysisPayloadMock.mockReset();
    sendAnalysisRequestMock.mockReset();
    if (originalFigma) {
      globalThis.figma = originalFigma;
    } else {
      delete (globalThis as Record<string, unknown>).figma;
    }
  });

  it("re-requests analysis when cached payload is structurally empty", async () => {
    const { createAnalysisRuntime } = await import("../../src/runtime/analysisRuntime");

    const runtime = createAnalysisRuntime({
      analysisEndpoint: "https://analysis.example/api/analyze/figma",
      promptVersion: "3.4.2",
      notifyUI,
      channels: createChannels()
    });

    await runtime.syncAccountStatus("pro");

    sendAnalysisRequestMock
      .mockResolvedValueOnce({
        heuristics: [],
        accessibility: [],
        psychology: [],
        impact: [],
        recommendations: []
      })
      .mockResolvedValueOnce({
        heuristics: [{ title: "Status", description: "OBS-1" }],
        accessibility: [],
        psychology: [],
        impact: [],
        recommendations: []
      });

    await runtime.handleAnalyzeSelection();

    expect(sendAnalysisRequestMock).toHaveBeenCalledTimes(1);
    const [, firstRequestPayload] = sendAnalysisRequestMock.mock.calls[0];
    expect(firstRequestPayload).toEqual(
      expect.objectContaining({
        selectionName: "Hero Frame",
        frames: [
          expect.objectContaining({
            frameId: "123",
            frameName: "Hero Frame",
            index: 0,
            image: expect.stringContaining("data:image/png;base64"),
            metadata: expect.objectContaining({
              flow: expect.objectContaining({ size: 1, index: 0 })
            })
          })
        ],
        metadata: expect.objectContaining({
          frameCount: 1,
          frames: [
            expect.objectContaining({ frameId: "123", frameName: "Hero Frame", index: 0 })
          ]
        })
      })
    );

    await runtime.handleAnalyzeSelection();

    expect(sendAnalysisRequestMock).toHaveBeenCalledTimes(2);
  });

  it("serves cached analysis when payload contains object-based sections", async () => {
    const { createAnalysisRuntime } = await import("../../src/runtime/analysisRuntime");

    const runtime = createAnalysisRuntime({
      analysisEndpoint: "https://analysis.example/api/analyze/figma",
      promptVersion: "3.4.2",
      notifyUI,
      channels: createChannels()
    });

    await runtime.syncAccountStatus("pro");

    const meaningfulAnalysis = {
      impact: {
        summary: "Observation gap: Subject-matter impact not fully captured.",
        areas: []
      },
      recommendations: {
        priority: "high",
        immediate: ["[impact:high][effort:low] Publish confirmation guidance in the overlay."]
      },
      heuristics: {
        visibility: {
          name: "Visibility of system status",
          summary: "Provide confirmation details to close the loop."
        }
      }
    };

    sendAnalysisRequestMock.mockResolvedValue(meaningfulAnalysis);

    await runtime.handleAnalyzeSelection();
    sendAnalysisRequestMock.mockClear();
    notifyUI.mockClear();

    await runtime.handleAnalyzeSelection();

    expect(sendAnalysisRequestMock).not.toHaveBeenCalled();
    expect(notifyUI).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ANALYSIS_RESULT",
        payload: expect.objectContaining({
          analysis: meaningfulAnalysis,
          frameCount: 1
        })
      })
    );
  });

  it("prevents analysis for non-paid accounts", async () => {
    clientStorageData["uxbiblio.freeCredits"] = {
      remaining: 0,
      total: 0,
      accountStatus: "anonymous"
    };

    const { createAnalysisRuntime } = await import("../../src/runtime/analysisRuntime");

    const runtime = createAnalysisRuntime({
      analysisEndpoint: "https://analysis.example/api/analyze/figma",
      promptVersion: "3.4.2",
      notifyUI,
      channels: createChannels()
    });

    await runtime.handleAnalyzeSelection();

    expect(sendAnalysisRequestMock).not.toHaveBeenCalled();
    expect(notifyUI).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ANALYSIS_ERROR",
        error: expect.stringContaining("No credits remaining")
      })
    );
  });

  it("blocks analysis when more than five exportable nodes are selected", async () => {
    const pageSelection = globalThis.figma.currentPage.selection;
    pageSelection.splice(
      0,
      pageSelection.length,
      ...Array.from({ length: 6 }).map((_, index) => ({
        id: `frame-${index}`,
        name: `Flow ${index + 1}`,
        type: "FRAME",
        exportAsync: vi.fn().mockResolvedValue(new Uint8Array([index + 1])),
        version: index + 1,
        width: 600,
        height: 400
      }))
    );

    const { createAnalysisRuntime } = await import("../../src/runtime/analysisRuntime");

    const runtime = createAnalysisRuntime({
      analysisEndpoint: "https://analysis.example/api/analyze/figma",
      promptVersion: "3.4.2",
      notifyUI,
      channels: createChannels()
    });

    await runtime.syncAccountStatus("pro");

    await runtime.handleAnalyzeSelection();

    expect(sendAnalysisRequestMock).not.toHaveBeenCalled();
    expect(notifyUI).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ANALYSIS_ERROR",
        error: expect.stringContaining("Select up to 5 frames")
      })
    );
  });

  it("allows analysis after paid account status sync", async () => {
    const pageSelection = globalThis.figma.currentPage.selection;
    pageSelection.splice(
      0,
      pageSelection.length,
      ...Array.from({ length: 2 }).map((_, index) => ({
        id: `frame-${index}`,
        name: `Step ${index + 1}`,
        type: "FRAME",
        exportAsync: vi.fn().mockResolvedValue(new Uint8Array([index + 1])),
        version: index + 1,
        width: 600,
        height: 400
      }))
    );

    const { createAnalysisRuntime } = await import("../../src/runtime/analysisRuntime");

    const runtime = createAnalysisRuntime({
      analysisEndpoint: "https://analysis.example/api/analyze/figma",
      promptVersion: "3.4.2",
      notifyUI,
      channels: createChannels()
    });

    await runtime.syncAccountStatus("pro");

    sendAnalysisRequestMock.mockResolvedValue({
      heuristics: [{ title: "Status", description: "OBS-1" }],
      accessibility: [],
      psychology: [],
      impact: [],
      recommendations: []
    });

    await runtime.handleAnalyzeSelection();

    expect(sendAnalysisRequestMock).toHaveBeenCalledTimes(1);
    expect(clientStorageData["uxbiblio.freeCredits"]).toEqual(
      expect.objectContaining({ accountStatus: "pro" })
    );
  });

  it("persists account status sync and refreshes selection state", async () => {
    const { createAnalysisRuntime } = await import("../../src/runtime/analysisRuntime");

    const runtime = createAnalysisRuntime({
      analysisEndpoint: "https://analysis.example/api/analyze/figma",
      promptVersion: "3.4.2",
      notifyUI,
      channels: createChannels()
    });

    notifyUI.mockClear();

    await runtime.syncAccountStatus("trial");

    expect(clientStorageData["uxbiblio.freeCredits"]).toEqual(
      expect.objectContaining({ accountStatus: "trial", remaining: 0, total: 0 })
    );

    expect(notifyUI).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SELECTION_STATUS",
        payload: expect.objectContaining({
          credits: expect.objectContaining({ accountStatus: "trial" })
        })
      })
    );
  });

  it("auto-promotes account status when auth portal opens against localhost", async () => {
    notifyUI.mockClear();
    const { createAnalysisRuntime } = await import("../../src/runtime/analysisRuntime");

    const runtime = createAnalysisRuntime({
      analysisEndpoint: "http://localhost:4292/api/analyze/figma",
      promptVersion: "3.5.2",
      notifyUI,
      channels: createChannels()
    });

    await runtime.handleAuthPortalOpened();

    expect(clientStorageData["uxbiblio.freeCredits"]).toEqual(
      expect.objectContaining({ accountStatus: "trial" })
    );

    expect(notifyUI).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SELECTION_STATUS",
        payload: expect.objectContaining({
          credits: expect.objectContaining({ accountStatus: "trial" })
        })
      })
    );
  });

  it("does not auto-promote account status when analysis endpoint is remote", async () => {
    notifyUI.mockClear();
    clientStorageData = {};

    const { createAnalysisRuntime } = await import("../../src/runtime/analysisRuntime");

    const runtime = createAnalysisRuntime({
      analysisEndpoint: "https://api.uxbiblio.com/api/analyze/figma",
      promptVersion: "3.5.2",
      notifyUI,
      channels: createChannels()
    });

    await runtime.handleAuthPortalOpened();

    expect(clientStorageData["uxbiblio.freeCredits"]).toBeUndefined();
    expect(notifyUI).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SELECTION_STATUS",
        payload: expect.objectContaining({
          credits: expect.objectContaining({ accountStatus: "trial" })
        })
      })
    );
  });
});
