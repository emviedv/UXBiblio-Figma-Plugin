import { render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RecommendationsAccordion } from "../../components/RecommendationsAccordion";

describe("RecommendationsAccordion accessibility and sanitization", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      throw new Error(`console.error called: ${String(args.join(" "))}`);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("renders sanitized recommendations within a landmark region", () => {
    render(
      <RecommendationsAccordion
        recommendations={[
          "[impact:medium][effort:low][Refs: heuristics[9], impact:Anxiety] Restore a visible focus indicator on the primary CTA."
        ]}
      />
    );

    const region = screen.getByRole("region");
    expect(region).not.toBeNull();
    expect(region?.textContent).toContain("Restore a visible focus indicator on the primary CTA.");
    expect(region?.textContent).not.toMatch(/impact:|Refs:/i);
  });
});
