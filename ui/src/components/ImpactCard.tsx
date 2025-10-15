import type { AnalysisSectionItem } from "../utils/analysis";
import { CollapsibleCard } from "./CollapsibleCard";
import { CardSection } from "./CardSection";
import { SeverityBadge } from "./SeverityBadge";

interface ImpactCardProps {
  items: AnalysisSectionItem[];
}

export function ImpactCard({ items }: ImpactCardProps): JSX.Element | null {
  if (!items.length) {
    return null;
  }

  return (
    <CollapsibleCard className="impact-card" bodyClassName="impact-card-body">
      {items.map((item, index) => {
        const content = parseImpactDescription(item.description);
        return (
          <CardSection
            key={`impact-item-${index}`}
            className="impact-card-section"
            title={item.title}
            actions={
              item.severity || typeof item.score === "number" ? (
                <SeverityBadge severity={item.severity} score={item.score} />
              ) : undefined
            }
          >
            <div className="impact-section-content">
              {content.summary.length > 0 ? (
                content.summary.map((paragraph, paragraphIndex) => (
                  <p key={`impact-summary-${index}-${paragraphIndex}`} className="impact-summary">
                    {paragraph}
                  </p>
                ))
              ) : (
                <p className="impact-summary is-empty">No summary captured.</p>
              )}

              {content.nextSteps.length > 0 ? (
                <div className="impact-next-steps">
                  <p className="impact-next-steps-title">Next Steps</p>
                  <ul className="impact-next-steps-list">
                    {content.nextSteps.map((step, stepIndex) => (
                      <li key={`impact-step-${index}-${stepIndex}`}>{step}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </CardSection>
        );
      })}
    </CollapsibleCard>
  );
}

function parseImpactDescription(description: string | undefined): {
  summary: string[];
  nextSteps: string[];
} {
  if (!description) {
    return { summary: [], nextSteps: [] };
  }

  const summary: string[] = [];
  const nextSteps: string[] = [];
  let mode: "summary" | "nextSteps" = "summary";

  const segments = description
    .split(/\r?\n+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  for (const rawSegment of segments) {
    const guardrailMatch = /^Guardrail\s+Recommendations?\b/i;
    const nextStepsMatch = /^Next\s+Steps?\b/i;

    if (guardrailMatch.test(rawSegment) || nextStepsMatch.test(rawSegment)) {
      mode = "nextSteps";
      const remainder = rawSegment.replace(/^(Guardrail\s+Recommendations?|Next\s+Steps?)\s*[:\-–—]?\s*/i, "");
      if (remainder.length > 0) {
        pushDelimited(remainder, nextSteps);
      }
      continue;
    }

    const bulletMatch = /^[-•]\s*(.+)$/.exec(rawSegment);
    if (bulletMatch) {
      const target = mode === "nextSteps" ? nextSteps : summary;
      target.push(bulletMatch[1].trim());
      continue;
    }

    if (mode === "nextSteps") {
      pushDelimited(rawSegment, nextSteps);
      continue;
    }

    summary.push(rawSegment);
  }

  return { summary, nextSteps };
}

function pushDelimited(value: string, bucket: string[]): void {
  const entries = value
    .split(/(?:;\s*|•\s*|·\s*|\u2022\s*)/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  bucket.push(...entries);
}
