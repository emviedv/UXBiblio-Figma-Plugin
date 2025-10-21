import { render } from "@testing-library/react";
import type { AnalysisSectionItem } from "../utils/analysis";
import { ProductPsychologyTab } from "../components/tabs/ProductPsychologyTab";

describe("ProductPsychologyTab layout", () => {
  it("uses shared card sections for each psychology insight", () => {
    const items: AnalysisSectionItem[] = [
      {
        title: "Curiosity Gap — Intentional",
        severity: "medium",
        description: "Summary\n- First signal\nGuardrail Recommendations\n- Mitigate risk",
        metadata: { intent: "intentional", guardrail: ["Trust"] }
      },
      {
        title: "Social Proof",
        description: "- Leverage testimonials"
      }
    ];

    const { container } = render(<ProductPsychologyTab items={items} />);
    const cardSurface = container.querySelector("section.card.psychology-card");
    expect(cardSurface).not.toBeNull();

    const sections = cardSurface?.querySelectorAll(".card-section");
    expect(sections).not.toBeNull();
    expect(sections?.length).toBe(items.length);
  });
});
