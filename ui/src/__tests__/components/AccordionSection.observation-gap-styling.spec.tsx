import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccordionSection } from "../../components/AccordionSection";

describe("AccordionSection — 'Observation gap:' paragraphs styled neutrally", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation((...args) => {
      throw new Error("Unexpected console.error: " + args.join(" "));
    });
  });

  it("renders a neutral style for 'Observation gap:' lines", () => {
    render(
      <AccordionSection
        title="Heuristics"
        items={[
          {
            title: "Visibility of System Status",
            description: "Observation gap: metadata missing for loading indicator."
          }
        ]}
      />
    );

    const para = screen.getByText(/Observation gap:/i);
    expect(para.className).toMatch(/observation-gap/);
  });
});

