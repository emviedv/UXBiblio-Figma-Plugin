import { render } from "@testing-library/react";
import type { AnalysisSectionItem } from "../utils/analysis";
import { ProductPsychologyTab } from "../components/tabs/ProductPsychologyTab";

describe("ProductPsychologyTab inline signals parsing", () => {
  it("renders inline Signals content as list items without showing the empty summary state", () => {
    const items: AnalysisSectionItem[] = [
      {
        title: "Curiosity Gap",
        description: "Signals: Teaser promise, Scarcity cue"
      }
    ];

    const { container } = render(<ProductPsychologyTab items={items} />);
    const fallback = container.querySelector(".psychology-summary.is-empty");
    expect(fallback).toBeNull();

    const summaries = Array.from(
      container.querySelectorAll<HTMLParagraphElement>(".psychology-summary")
    ).map((node) => node.textContent?.trim());
    expect(summaries).toEqual([]);

    const signalItems = Array.from(
      container.querySelectorAll<HTMLLIElement>('[data-ux-section="psychology-signals"] li')
    ).map((node) => node.textContent?.trim());
    expect(signalItems).toEqual(["Teaser promise", "Scarcity cue"]);
  });
});
