import { describe, it, expect, beforeAll, vi } from "vitest";
import { normalizeAnalysis } from "../../utils/analysis";

describe("normalizeAnalysis — section sources merged into receipts", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation((...args) => {
      throw new Error("Unexpected console.error: " + args.join(" "));
    });
  });

  it("collects sources from heuristics, impact, psychology", () => {
    const raw = {
      heuristics: [
        {
          name: "Consistency and Standards",
          insights: ["Because OBS-1, users may …"],
          sources: [
            {
              title: "NN/g Heuristics",
              url: "https://www.nngroup.com",
              domainTier: "T1",
              publishedYear: 2024,
              usedFor: "heuristics[4]"
            }
          ]
        }
      ],
      impact: {
        summary: "Potential conversion risk on primary CTA.",
        areas: [
          {
            category: "Conversion Rates",
            severity: "high",
            summary: "OBS-2 points to low salience of CTA.",
            recommendations: ["Test a higher-contrast primary CTA"],
            sources: [
              {
                title: "Baymard — Product Page UX",
                url: "https://baymard.com",
                domainTier: "T1",
                publishedYear: 2025,
                usedFor: "impact:Conversion Rates"
              }
            ]
          }
        ]
      },
      psychology: {
        persuasionTechniques: [
          {
            title: "Default Bias via Primary CTA Emphasis",
            summary: "OBS-1, OBS-3 show visual weighting.",
            intent: "intentional",
            stage: "onboarding",
            guardrail: "Avoid coercion",
            signals: ["Default bias"],
            recommendations: ["Reinforce affordance via contrast and sizing"],
            sources: [
              {
                title: "NN/g — Default Effects",
                url: "https://www.nngroup.com/articles/default-effect/",
                domainTier: "T1",
                publishedYear: 2024,
                usedFor: "psychology:defaults"
              }
            ]
          }
        ],
        behavioralTriggers: []
      }
    } as unknown;

    const normalized = normalizeAnalysis(raw);
    expect(normalized.receipts.length).toBe(3);
    const titles = normalized.receipts.map((s) => s.title);
    expect(titles).toEqual(
      expect.arrayContaining(["NN/g Heuristics", "Baymard — Product Page UX", "NN/g — Default Effects"])
    );
  });
});

