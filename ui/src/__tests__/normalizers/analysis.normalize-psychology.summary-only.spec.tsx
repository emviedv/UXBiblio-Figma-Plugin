import { afterAll, describe, expect, it, vi } from "vitest";
import { normalizePsychology } from "../../utils/analysis";
import { logger } from "@shared/utils/logger";

describe("normalizePsychology summary-only payload", () => {
  const debugSpy = vi.spyOn(logger, "debug").mockImplementation(() => undefined);
  const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);

  afterAll(() => {
    debugSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("returns a synthesized item when only summary fields exist", () => {
    const result = normalizePsychology({
      summary: "Highlights the curiosity gap lever to draw users deeper.",
      notes: "Guardrail: ensure claims remain verifiable."
    });

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]?.title).toBe("Psychology Insight");
    expect(result[0]?.description).toContain("Highlights the curiosity gap lever");
  });
});
