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
          analysis: meaningfulAnalysis
        })
      })
    );
  });

  it("prevents analysis when free credits are exhausted for anonymous accounts", async () => {
    clientStorageData["uxbiblio.freeCredits"] = {
      remaining: 0,
      total: 8,
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
        error: expect.stringContaining("Sign in")
      })
    );
  });
});
