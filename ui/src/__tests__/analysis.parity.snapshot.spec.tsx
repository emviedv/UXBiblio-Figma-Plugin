import { afterEach, describe, expect, it } from "vitest";
import { cleanupApp, dispatchPluginMessage, renderApp, tick } from "../../../tests/ui/testHarness";

describe("Analysis parity snapshot", () => {
  afterEach(() => {
    cleanupApp();
  });

  it("renders parity fields from Chrome-derived analysis payloads", async () => {
    const container = renderApp();

    dispatchPluginMessage({
      type: "ANALYSIS_RESULT",
      payload: {
        selectionName: "Marketing Checkout",
        exportedAt: "2025-10-16T12:00:00.000Z",
        analysis: {
          summary: "OBS-1 and OBS-5 show onboarding reassurance lagging behind CTA taps.",
          scopeNote: "OBS-2: logged-out prompt flows.",
          receipts: [
            {
              title: "NN/g – Reduce Anxiety in Trial CTA",
              url: "https://www.nngroup.com/articles/trial-anxiety/",
              domainTier: "T1",
              usedFor: "heuristics"
            }
          ],
          uxCopywriting: {
            heading: "Trial CTA Reassurance",
            sections: [
              {
                id: "messaging-summary",
                title: "Messaging Summary",
                blocks: [
                  {
                    type: "text",
                    text: "OBS-1 shows CTA microcopy prioritizing urgency over reassurance."
                  }
                ]
              },
              {
                id: "voice-tone",
                title: "Voice & Tone",
                blocks: [
                  {
                    type: "text",
                    text: "Tone oscillates between urgent and calming, creating cognitive dissonance."
                  }
                ]
              },
              {
                id: "notable-copy",
                title: "Notable On-screen Copy",
                blocks: [
                  {
                    type: "list",
                    items: [
                      "CTA: \"Try Pro Free\" with microcopy \"No credit card required\"",
                      "Footer reassurance: \"Cancel anytime\" hidden behind accordion"
                    ]
                  }
                ]
              }
            ]
          },
          heuristicScorecard: {
            strengths: [
              {
                name: "Recognition rather than recall",
                score: 4,
                reason: "OBS-7 password rules inline."
              }
            ],
            weaknesses: [
              {
                name: "Help users recover from errors",
                score: 2,
                reason: "OBS-9 missing recovery guidance."
              }
            ]
          },
          heuristics: [
            {
              title: "Match between system and real world",
              description: "OBS-3 shows jargon-heavy confirmation."
            }
          ],
          accessibilityCheck: {
            contrastScore: "Fair",
            contrastStatus: "Needs WCAG 2.2 AA",
            actionableRecommendation: "Increase CTA contrast to 4.5:1."
          },
          accessibility: {
            summary: "CTA contrast is 3.1:1 against background (OBS-4).",
            keyRecommendation: "Raise CTA text color to hit AA levels.",
            issues: ["WCAG 2.2 1.4.3 - CTA text contrast 3.1:1 (OBS-4)"]
          },
          impact: {
            summary: "Trust erosion observed during trial opt-in.",
            areas: [
              {
                category: "Trust & Credibility",
                severity: "high",
                summary: "OBS-1 shows hesitation when reassurance is hidden.",
                recommendations: ["Surface cancellation policy above fold."],
                sources: [
                  {
                    title: "Baymard – Trust in Checkout",
                    url: "https://baymard.com/blog/checkout-trust",
                    domainTier: "T1"
                  }
                ]
              }
            ]
          },
          psychology: [
            {
              title: "Loss Aversion",
              description: "Guarantee hidden until late in flow.",
              severity: "risky"
            }
          ],
          recommendations: {
            immediate: [
              {
                text: "Add \"Cancel anytime\" beside CTA.",
                priority: "high"
              }
            ],
            longTerm: [
              {
                text: "A/B test reassurance placements to confirm lift.",
                priority: "medium"
              }
            ]
          }
        }
      }
    });

    await tick();

    const card = container.querySelector(".copywriting-card");
    expect(card).not.toBeNull();
  });
});
