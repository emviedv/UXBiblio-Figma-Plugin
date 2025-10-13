import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SummaryCard } from "../../components/SummaryCard";

describe("SummaryCard — suggestions", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation((...args) => {
      throw new Error("Unexpected console.error: " + args.join(" "));
    });
  });

  it("renders up to three suggestions sourced from UX Copy guidance", () => {
    render(
      <SummaryCard
        summary="Banner introduces AI benefits but lacks a clear CTA."
        receipts={[]}
        suggestions={[
          "Add a primary CTA like ‘Browse the Library’.",
          "Include a secondary CTA: ‘Try a Sample’.",
          "Provide a tertiary link: ‘See How It Works’.",
          "This fourth item should be truncated."
        ]}
      />
    );

    // Validate the first three suggestions are present
    expect(screen.getByText(/Browse the Library/i)).toBeTruthy();
    expect(screen.getByText(/Try a Sample/i)).toBeTruthy();
    expect(screen.getByText(/See How It Works/i)).toBeTruthy();

    // And the fourth is not rendered
    expect(screen.queryByText(/This fourth item should be truncated/i)).toBeNull();
  });
});

