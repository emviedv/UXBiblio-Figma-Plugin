import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { debugService } from "@shared/services/debug-service";

const endpoint = "https://api.example.com/api/analyze";

describe("analysis request utility", () => {
  beforeAll(() => {
    debugService.setEnabled(false);
  });

  afterAll(() => {
    debugService.setEnabled(true);
  });

  it("posts payload to analysis endpoint and returns parsed json", async () => {
    const json = { heuristics: [] };
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => json,
      text: async () => ""
    }));

    const { sendAnalysisRequest } = await import("@shared/utils/analysis");

    const payload = {
      selectionName: "Frame",
      frames: [{ frameId: "frame-0", frameName: "Frame", index: 0, image: "base64" }]
    };
    const response = await sendAnalysisRequest(endpoint, payload, {
      fetchImpl,
      timeoutMs: 10_000
    });

    expect(fetchImpl).toHaveBeenCalledWith(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, source: "figma-plugin" }),
      signal: expect.any(AbortSignal)
    });
    expect(response).toEqual(json);
  });

  it("falls back to the global fetch implementation when none is provided", async () => {
    const originalFetch = globalThis.fetch;
    const json = { heuristics: [] };
    const mockFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => json,
      text: async () => ""
    }));

    // Override global fetch to simulate the plugin environment resolution.
    const globalWithFetch = globalThis as typeof globalThis & { fetch?: typeof fetch };
    globalWithFetch.fetch = mockFetch as unknown as typeof fetch;

    const { sendAnalysisRequest } = await import("@shared/utils/analysis");

    const payload = {
      selectionName: "Frame",
      frames: [{ frameId: "frame-0", frameName: "Frame", index: 0, image: "base64" }]
    };
    const response = await sendAnalysisRequest(endpoint, payload);

    expect(mockFetch).toHaveBeenCalledWith(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, source: "figma-plugin" }),
      signal: expect.any(AbortSignal)
    });
    expect(response).toEqual(json);

    if (typeof originalFetch === "function") {
      globalWithFetch.fetch = originalFetch;
    } else {
      delete globalWithFetch.fetch;
    }
  });

  it("throws descriptive error on non-OK responses", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("not json");
      },
      text: async () => "Bad gateway"
    }));

    const { sendAnalysisRequest } = await import("@shared/utils/analysis");

    await expect(
      sendAnalysisRequest(
        endpoint,
        {
          selectionName: "Frame",
          frames: [{ frameId: "frame-0", frameName: "Frame", index: 0, image: "x" }]
        },
        { fetchImpl }
      )
    ).rejects.toThrow("Analysis request failed (502): Bad gateway");
  });

  it("translates aborted requests into timeout error", async () => {
    const abortError = new Error("The user aborted a request");
    abortError.name = "AbortError";

    const fetchImpl = vi.fn(async () => {
      throw abortError;
    });

    const { sendAnalysisRequest } = await import("@shared/utils/analysis");

    await expect(
      sendAnalysisRequest(
        endpoint,
        {
          selectionName: "Frame",
          frames: [{ frameId: "frame-0", frameName: "Frame", index: 0, image: "x" }]
        },
        { fetchImpl }
      )
    ).rejects.toThrow("Analysis took too long. Try again or simplify your selection.");
  });
});
