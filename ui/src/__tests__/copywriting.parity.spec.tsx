import { afterEach, describe, expect, it } from "vitest";
import { cleanupApp, dispatchPluginMessage, renderApp, tick } from "../../../tests/ui/testHarness";

function renderCopywritingAnalysis(payload: Record<string, unknown>) {
  const container = renderApp();
  dispatchPluginMessage({
    type: "ANALYSIS_RESULT",
    payload: {
      selectionName: "Pricing Modal",
      exportedAt: "2025-05-05T14:45:00.000Z",
      analysis: payload
    }
  });
  return { container };
}

describe("Copywriting parity with Chrome extension", () => {
  afterEach(() => {
    cleanupApp();
  });

  it("renders server-supplied copywriting sections including Voice & Tone and Notable On-screen Copy", async () => {
    const { container } = renderCopywritingAnalysis({
      summary: "Baseline summary.",
      uxCopywriting: {
        heading: "Copywriting Insights",
        sections: [
          {
            id: "messaging-summary",
            title: "Messaging Summary",
            blocks: [{ type: "text", text: "Topline messaging summary." }]
          },
          {
            id: "voice-tone",
            title: "Voice & Tone",
            blocks: [{ type: "text", text: "Calming tone with microcopy reassurance." }]
          },
          {
            id: "notable-copy",
            title: "Notable On-screen Copy",
            blocks: [{ type: "list", items: ["Upgrade CTA: “Try Pro Free”"] }]
          }
        ]
      },
      heuristics: [],
      accessibility: [],
      psychology: [],
      impact: [],
      recommendations: []
    });
    await tick();

    const headings = Array.from(container.querySelectorAll<HTMLElement>(".card-section-title"));
    const voiceHeading = headings.find((heading) =>
      heading.textContent?.trim().startsWith("Voice & Tone")
    );
    expect(voiceHeading, "Voice & Tone heading should render when supplied by analysis").toBeTruthy();

    const notableHeading = headings.find((heading) =>
      heading.textContent?.trim().startsWith("Notable On-screen Copy")
    );
    expect(
      notableHeading,
      "Notable On-screen Copy section should render when supplied by analysis"
    ).toBeTruthy();
  });

  it("synthesizes Voice & Tone and Notable On-screen Copy when sections are absent", async () => {
    const { container } = renderCopywritingAnalysis({
      summary: "OBS-1 onboarding reassurance is buried.",
      uxCopywriting: {
        heading: "Guarantee Messaging",
        summary: "OBS-1/OBS-2 highlight hidden reassurance copy.",
        guidance: ["Move guarantee copy above CTA.", "Mention refund timeline near CTA."],
        sources: []
      },
      psychology: [
        { title: "Curiosity Gap", description: "Large promise without detail.", severity: "risky" }
      ],
      impact: {
        areas: [
          {
            category: "Trust & Credibility",
            severity: "high",
            summary: "OBS-1 indicates users hesitate without clear reassurance."
          }
        ]
      },
      heuristics: [
        {
          title: "Match Between System and the Real World",
          description: "OBS-3 placeholder copy sounds robotic."
        }
      ],
      accessibility: [],
      recommendations: []
    });
    await tick();

    const headings = Array.from(container.querySelectorAll<HTMLElement>(".card-section-title"));
    const voiceHeading = headings.find((heading) =>
      heading.textContent?.trim().startsWith("Voice & Tone")
    );
    expect(
      voiceHeading,
      "Voice & Tone section should be synthesized from psychology metadata when not provided"
    ).toBeTruthy();

    const notableHeading = headings.find((heading) =>
      heading.textContent?.trim().startsWith("Notable On-screen Copy")
    );
    expect(
      notableHeading,
      "Notable On-screen Copy section should synthesize from extracted guidance/analysis"
    ).toBeTruthy();
  });
});
