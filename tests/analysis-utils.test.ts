import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { debugService } from "@shared/services/debug-service";

const endpoint = "https://api.example.com/api/analyze/figma";

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

    const payload = { image: "base64", selectionName: "Frame" };
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
      sendAnalysisRequest(endpoint, { image: "x", selectionName: "Frame" }, { fetchImpl })
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
      sendAnalysisRequest(endpoint, { image: "x", selectionName: "Frame" }, { fetchImpl })
    ).rejects.toThrow("Analysis took too long. Try again or simplify your selection.");
  });
});
