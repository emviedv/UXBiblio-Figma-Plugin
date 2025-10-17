import { describe, expect, it } from "vitest";
import { normalizeCopywriting } from "../../utils/analysis";

describe("normalizeCopywriting", () => {
  it("merges guidance sources, strips OBS tokens, and filters receipts", () => {
    const normalized = normalizeCopywriting({
      heading: "Hero Headline ",
      summary: "OBS-12: Encourage action",
      guidance: ["Provide CTA"],
      notes: ["  Use accessible copy  "],
      recommendations: ["OBS-13 Provide CTA"],
      examples: ["Add proof point"],
      bullets: ["OBS-15 Provide CTA"],
      sources: [
        {
          title: "NN/g Copywriting",
          url: "https://www.nngroup.com/articles/",
          domainTier: "T1",
          publishedYear: 2024,
          usedFor: "copywriting"
        },
        {
          url: "https://uxbiblio.com/resource"
        },
        { title: "", url: "" }
      ]
    });

    expect(normalized.heading).toBe("Hero Headline");
    expect(normalized.summary).toBe("Encourage action");
    expect(normalized.guidance).toEqual([
      "Provide CTA",
      "Use accessible copy",
      "Add proof point"
    ]);
    expect(normalized.sources).toEqual([
      {
        title: "NN/g Copywriting",
        url: "https://www.nngroup.com/articles/",
        domainTier: "T1",
        usedFor: "copywriting",
        publishedYear: 2024
      },
      {
        title: "https://uxbiblio.com/resource",
        url: "https://uxbiblio.com/resource",
        domainTier: undefined,
        usedFor: undefined,
        publishedYear: undefined
      }
    ]);

    expect(normalizeCopywriting(undefined)).toEqual({
      heading: undefined,
      summary: undefined,
      sections: [],
      guidance: [],
      sources: []
    });
  });

  it("preserves heading-only payloads without inventing summary content", () => {
    const normalized = normalizeCopywriting({
      heading: "Guarantee Messaging ",
      summary: "",
      guidance: [],
      sources: []
    });

    expect(normalized.heading).toBe("Guarantee Messaging");
    expect(normalized.summary).toBeUndefined();
    expect(normalized.sections).toEqual([]);
    expect(normalized.guidance).toEqual([]);
    expect(normalized.sources).toEqual([]);
  });
});
