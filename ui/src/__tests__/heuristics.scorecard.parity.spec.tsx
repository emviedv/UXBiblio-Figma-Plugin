import { afterEach, describe, expect, it } from "vitest";
import {
  act,
  cleanupApp,
  dispatchPluginMessage,
  renderApp,
  tick
} from "../../../tests/ui/testHarness";

function renderHeuristicScorecardPayload(analysis: Record<string, unknown>) {
  const container = renderApp();
  dispatchPluginMessage({
    type: "ANALYSIS_RESULT",
    payload: {
      selectionName: "Checkout Overlay",
      exportedAt: "2025-10-18T14:05:00.000Z",
      analysis
    }
  });
  return container;
}

describe("Heuristics tab — Chrome parity scorecard", () => {
  afterEach(() => {
    cleanupApp();
  });

  it("renders strengths and weaknesses from heuristicScorecard payload", async () => {
    const container = renderHeuristicScorecardPayload({
      summary: "Scorecard parity target.",
      heuristicScorecard: {
        strengths: [
          {
            name: "Recognition rather than recall",
            score: 4,
            reason: "OBS-7 password rules inline bolsters memory."
          }
        ],
        weaknesses: [
          {
            name: "Help users recover from errors",
            score: 2,
            reason: "OBS-9 lacks inline recovery suggestions."
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

    const heuristicsTab = container.querySelector<HTMLButtonElement>("#analysis-tab-heuristics");
    expect(heuristicsTab, "Heuristics tab button should exist").not.toBeNull();
    await act(async () => {
      heuristicsTab!.click();
    });
    await tick();

    const scorecard = container.querySelector('[data-heuristic-scorecard="true"]');
    expect(scorecard, "Heuristic scorecard root should render for scorecard payload").not.toBeNull();

    const strengths = Array.from(
      scorecard!.querySelectorAll('[data-heuristic-scorecard-section="strengths"] li')
    ).map((node) => node.textContent?.trim());
    expect(strengths).toContain(
      "Recognition rather than recall — Score 4/5 — password rules inline bolsters memory."
    );

    const weaknesses = Array.from(
      scorecard!.querySelectorAll('[data-heuristic-scorecard-section="weaknesses"] li')
    ).map((node) => node.textContent?.trim());
    expect(weaknesses).toContain(
      "Help users recover from errors — Score 2/5 — lacks inline recovery suggestions."
    );
  });

  it("omits empty scorecard sections but still renders populated categories", async () => {
    const container = renderHeuristicScorecardPayload({
      summary: "Scorecard edge-case parity.",
      heuristicScorecard: {
        strengths: [
          {
            name: "Match between system and the real world",
            score: 5
          }
        ],
        weaknesses: [],
        opportunities: []
      },
      heuristics: [],
      accessibility: [],
      psychology: [],
      impact: [],
      recommendations: []
    });

    await tick();

    const heuristicsTab = container.querySelector<HTMLButtonElement>("#analysis-tab-heuristics");
    expect(heuristicsTab, "Heuristics tab button should exist for edge-case payload").not.toBeNull();
    await act(async () => {
      heuristicsTab!.click();
    });
    await tick();

    const scorecard = container.querySelector('[data-heuristic-scorecard="true"]');
    expect(scorecard, "Heuristic scorecard root should render when strengths are present").not.toBeNull();

    const strengths = Array.from(
      scorecard!.querySelectorAll('[data-heuristic-scorecard-section="strengths"] li')
    ).map((node) => node.textContent?.trim());
    expect(strengths).toContain(
      "Match between system and the real world — Score 5/5 — No supporting rationale provided."
    );

    const weaknessesSection = scorecard!.querySelector(
      '[data-heuristic-scorecard-section="weaknesses"]'
    );
    expect(weaknessesSection, "Weaknesses section should be omitted when payload is empty").toBeNull();
    const opportunitiesSection = scorecard!.querySelector(
      '[data-heuristic-scorecard-section="opportunities"]'
    );
    expect(opportunitiesSection, "Opportunities section should be omitted when payload is empty").toBeNull();
  });
});
