import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("analysis endpoint helper", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const globalRef = globalThis as { URL?: typeof URL };
  const originalUrlCtor = globalRef.URL;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    globalRef.URL = originalUrlCtor;
  });

  it("returns local analysis proxy endpoint by default in non-production envs", async () => {
    process.env.NODE_ENV = "test";
    const { buildAnalysisEndpoint } = await import("@shared/utils/endpoints");

    expect(buildAnalysisEndpoint()).toEqual("http://localhost:4292/api/analyze");
  });

  it("returns production endpoint when NODE_ENV is production", async () => {
    process.env.NODE_ENV = "production";
    const { buildAnalysisEndpoint } = await import("@shared/utils/endpoints");

    expect(buildAnalysisEndpoint()).toEqual("https://api.uxbiblio.com/api/analyze");
  });

  it("uses environment override, trims trailing slash, and preserves protocol", async () => {
    const { buildAnalysisEndpoint } = await import("@shared/utils/endpoints");

    expect(buildAnalysisEndpoint("https://staging.uxbiblio.com/")).toEqual(
      "https://staging.uxbiblio.com/api/analyze"
    );
  });

  it("adds an http scheme when missing for localhost overrides", async () => {
    const { buildAnalysisEndpoint } = await import("@shared/utils/endpoints");

    expect(buildAnalysisEndpoint("localhost:5000")).toEqual(
      "http://localhost:5000/api/analyze"
    );
  });

  it("returns a valid endpoint when URL global is not available", async () => {
    globalRef.URL = undefined;
    const { buildAnalysisEndpoint } = await import("@shared/utils/endpoints");

    expect(buildAnalysisEndpoint("localhost:5001/")).toEqual(
      "http://localhost:5001/api/analyze"
    );
  });
});
