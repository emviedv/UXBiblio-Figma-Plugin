import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SummaryCard } from "../../components/SummaryCard";

describe("SummaryCard — meta chips", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation((...args) => {
      throw new Error("Unexpected console.error: " + args.join(" "));
    });
  });

  it("suppresses meta/classification chips in UX Summary", () => {
    render(
      <SummaryCard
        summary="Short summary"
        receipts={[]}
        meta={{
          contentType: "ui-screen",
          flows: ["onboarding", "likely:signup"],
          industries: ["Software as a Service"],
          uiElements: ["Call to Action"],
          psychologyTags: ["Curiosity Gap"],
          suggestedCollection: "Flows",
          suggestedTags: ["flow:onboarding", "wcag-contrast"],
          confidence: { level: "high", rationale: "OBS-1, OBS-2" }
        }}
      />
    );

    // Ensure none of the chips/labels render in the Summary view
    expect(screen.queryByText(/Confidence:/i)).toBeNull();
    expect(screen.queryByText(/Evidence:/i)).toBeNull();
    expect(screen.queryByText(/ui-screen/i)).toBeNull();
    expect(screen.queryByText(/onboarding/i)).toBeNull();
    expect(screen.queryByText(/Software as a Service/i)).toBeNull();
    expect(screen.queryByText(/Call to Action/i)).toBeNull();
    expect(screen.queryByText(/Curiosity Gap/i)).toBeNull();
    expect(screen.queryByText(/Flows/i)).toBeNull();
    expect(screen.queryByText(/wcag-contrast/i)).toBeNull();
  });
});
