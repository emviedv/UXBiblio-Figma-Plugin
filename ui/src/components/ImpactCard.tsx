import type { AnalysisSectionItem } from "../utils/analysis";
import { CollapsibleCard } from "./CollapsibleCard";
import { CardSection } from "./CardSection";
import { SeverityBadge } from "./SeverityBadge";
import { Badge } from "./primitives/Badge";

interface ImpactCardProps {
  items: AnalysisSectionItem[];
}

export function ImpactCard({ items }: ImpactCardProps): JSX.Element | null {
  if (!items.length) {
    return null;
  }

  return (
    <CollapsibleCard className="impact-card" bodyElement="ul">
      {items.map((item, index) => {
        const content = parseImpactDescription(item.description);
        const metadataChips = buildImpactMetadataChips(item.metadata);
        return (
          <li key={`impact-item-${index}`} className="card-item">
            <CardSection
              title={item.title}
              actions={
                item.severity || typeof item.score === "number" ? (
                  <SeverityBadge severity={item.severity} score={item.score} />
                ) : undefined
              }
            >
              <div className="impact-section-content">
                {metadataChips.length > 0 ? (
                  <div className="recommendation-meta impact-meta">
                    {metadataChips.map((chip, chipIndex) => (
                      <Badge
                        key={`impact-chip-${index}-${chipIndex}`}
                        tone={chip.tone}
                        data-impact-chip={chip.type}
                        aria-label={`${chip.label} ${chip.value}`}
                      >
                        {`${chip.label} ${chip.value}`}
                      </Badge>
                    ))}
                  </div>
                ) : null}
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
          </li>
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

function buildImpactMetadataChips(
  metadata: Record<string, string | string[]> | undefined
): Array<{ type: string; label: string; value: string; tone: string }> {
  if (!metadata) {
    return [];
  }

  const chips: Array<{ type: string; label: string; value: string; tone: string }> = [];

  const impactValue = extractMetadataValue(metadata, "impact");
  if (impactValue) {
    chips.push({ type: "impact", label: "Impact", value: impactValue, tone: "impact" });
  }

  const effortValue = extractMetadataValue(metadata, "effort");
  if (effortValue) {
    chips.push({ type: "effort", label: "Effort", value: effortValue, tone: "effort" });
  }

  const refs = extractMetadataArray(metadata, "refs");
  if (refs.length > 0) {
    chips.push({
      type: "refs",
      label: "Refs",
      value: refs.join(", "),
      tone: "refs"
    });
  }

  return chips;
}

function extractMetadataValue(metadata: Record<string, string | string[]>, key: string): string | undefined {
  const value = metadata[key];
  if (Array.isArray(value)) {
    const first = value.find((entry) => entry.trim().length > 0);
    return first ? first.trim() : undefined;
  }
  return value?.trim() || undefined;
}

function extractMetadataArray(metadata: Record<string, string | string[]>, key: string): string[] {
  const value = metadata[key];
  if (Array.isArray(value)) {
    return value.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
}
