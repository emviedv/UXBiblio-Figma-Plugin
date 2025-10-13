import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SummaryCard } from "../../components/SummaryCard";

describe("SummaryCard — evidence badge", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation((...args) => {
      throw new Error("Unexpected console.error: " + args.join(" "));
    });
  });

  it("does not render an evidence badge (metadata suppressed)", () => {
    const { rerender } = render(
      <SummaryCard summary="Some summary" receipts={[]} meta={{ obsCount: 7 }} />
    );
    expect(screen.queryByText(/Evidence:/i)).toBeNull();

    rerender(
      <SummaryCard summary="Some summary" receipts={[]} meta={{ obsCount: 0 }} />
    );
    expect(screen.queryByText(/Evidence:/i)).toBeNull();
  });
});
