import type { LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { CardSection } from "./CardSection";
import { SeverityBadge } from "./SeverityBadge";

export function RecommendationsAccordion({
  recommendations,
  icon: _Icon
}: {
  recommendations: string[];
  icon?: LucideIcon;
}): JSX.Element | null {
  const partitioned = useMemo(() => partitionRecommendationEntries(recommendations), [
    recommendations
  ]);

  if (!recommendations.length) {
    return null;
  }

  return (
    <section className="card accordion accordion-open" data-card-surface="true">
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

    if (/^overall priority:/i.test(trimmed)) {
      priority = trimmed.replace(/^overall priority:\s*/i, "").trim();
      continue;
    }

    if (/^\[immediate]/i.test(trimmed)) {
      immediate.push(trimmed.replace(/^\[immediate]\s*/i, "").trim());
      continue;
    }

    if (/^\[long-term]/i.test(trimmed)) {
      longTerm.push(trimmed.replace(/^\[long-term]\s*/i, "").trim());
      continue;
    }

    general.push(trimmed);
  }

  return { priority, immediate, longTerm, general };
}
