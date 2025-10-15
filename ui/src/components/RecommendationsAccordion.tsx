import { useMemo } from "react";
import { CardSection } from "./CardSection";
import { SeverityBadge } from "./SeverityBadge";
import { sanitizeRecommendationText } from "../utils/analysis/recommendations";

export function RecommendationsAccordion({
  recommendations
}: {
  recommendations: string[];
}): JSX.Element | null {
  const partitioned = useMemo(() => partitionRecommendationEntries(recommendations), [
    recommendations
  ]);

  if (!recommendations.length) {
    return null;
  }

  return (
    <section
      className="card accordion accordion-open"
      data-card-surface="true"
      aria-label="Recommendations"
    >
      <ul className="card-body">
        {partitioned.priority && (
          <li className="card-item">
            <CardSection
              title="Overall Priority"
              actions={<SeverityBadge severity={partitioned.priority} />}
            >
              <></>
            </CardSection>
          </li>
        )}

        {partitioned.immediate.length > 0 && (
          <li className="card-item">
            <CardSection title="Immediate Actions">
              {partitioned.immediate.map((item, index) => (
                <p key={`immediate-${index}`} className="card-item-description">
                  {item}
                </p>
              ))}
            </CardSection>
          </li>
        )}

        {partitioned.longTerm.length > 0 && (
          <li className="card-item">
            <CardSection title="Long-term Next Steps">
              {partitioned.longTerm.map((item, index) => (
                <p key={`longterm-${index}`} className="card-item-description">
                  {item}
                </p>
              ))}
            </CardSection>
          </li>
        )}

        {partitioned.general.map((item, index) => (
          <li key={`general-${index}`} className="card-item">
            <CardSection>
              <p className="card-item-description">{item}</p>
            </CardSection>
          </li>
        ))}
      </ul>
    </section>
  );
}

function partitionRecommendationEntries(entries: string[]): {
  priority: string | null;
  immediate: string[];
  longTerm: string[];
  general: string[];
} {
  const immediate: string[] = [];
  const longTerm: string[] = [];
  const general: string[] = [];
  let priority: string | null = null;

  for (const entry of entries) {
    if (typeof entry !== "string") {
      continue;
    }

    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }

    if (/^overall priority:/i.test(trimmed)) {
      const priorityValue = sanitizeRecommendationText(
        trimmed.replace(/^overall priority:\s*/i, "").trim()
      );
      if (priorityValue) {
        priority = priorityValue;
      }
      continue;
    }

    if (/^\[immediate(?:[^\]]*)?]/i.test(trimmed)) {
      const immediateValue = sanitizeRecommendationText(
        trimmed.replace(/^\[immediate(?:[^\]]*)?]\s*/i, "").trim()
      );
      if (immediateValue) {
        immediate.push(immediateValue);
      }
      continue;
    }

    if (/^\[long-term(?:[^\]]*)?]/i.test(trimmed)) {
      const longTermValue = sanitizeRecommendationText(
        trimmed.replace(/^\[long-term(?:[^\]]*)?]\s*/i, "").trim()
      );
      if (longTermValue) {
        longTerm.push(longTermValue);
      }
      continue;
    }

    const sanitized = sanitizeRecommendationText(trimmed);
    if (sanitized) {
      general.push(sanitized);
    }
  }

  return { priority, immediate, longTerm, general };
}
