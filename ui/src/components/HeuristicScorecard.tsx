import type { HeuristicScorecard, HeuristicScorecardEntry } from "../utils/analysis";
import { CardSection } from "./CardSection";

const SCORECARD_SECTIONS: Array<{
  key: keyof HeuristicScorecard;
  title: string;
}> = [
  { key: "strengths", title: "Strengths" },
  { key: "weaknesses", title: "Weaknesses" },
  { key: "opportunities", title: "Opportunities" }
];

export function HeuristicScorecard({ scorecard }: { scorecard: HeuristicScorecard }): JSX.Element | null {
  if (!scorecard) {
    return null;
  }

  const hasContent = SCORECARD_SECTIONS.some((section) => {
    const entries = scorecard[section.key];
    return Array.isArray(entries) && entries.length > 0;
  });

  if (!hasContent) {
    return null;
  }

  return (
    <section className="card heuristic-scorecard" data-heuristic-scorecard="true" data-card-surface="true">
      <ul className="card-body">
        {SCORECARD_SECTIONS.map((section) => {
          const entries = scorecard[section.key];
          if (!Array.isArray(entries) || entries.length === 0) {
            return null;
          }

          return (
            <li key={section.title} className="card-item">
              <CardSection
                title={section.title}
                className="card-item-section"
                data-heuristic-scorecard-section={section.key}
              >
                <ul className="card-item-list">
                  {entries.map((entry, index) => (
                    <li key={`${section.key}-${index}`}>{formatScorecardEntry(entry)}</li>
                  ))}
                </ul>
              </CardSection>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function formatScorecardEntry(entry: HeuristicScorecardEntry): string {
  const parts: string[] = [];
  if (entry.name) {
    parts.push(entry.name);
  }

  if (typeof entry.score === "number" && !Number.isNaN(entry.score)) {
    parts.push(`Score ${formatScore(entry.score)}/5`);
  }

  if (entry.reason) {
    parts.push(entry.reason);
  }

  if (parts.length <= 1) {
    const fallbackReason = entry.reason ?? "No supporting rationale provided.";
    return `${parts[0] ?? "Insight"} — ${fallbackReason}`;
  }

  if (!entry.reason) {
    parts.push("No supporting rationale provided.");
  }

  return parts.join(" — ");
}

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1).replace(/\.0$/, "");
}
