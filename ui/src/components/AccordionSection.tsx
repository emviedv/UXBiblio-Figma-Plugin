import type { LucideIcon } from "lucide-react";
import type { AnalysisSectionItem } from "../utils/analysis";
import { CardSection } from "./CardSection";
import { SeverityBadge } from "./SeverityBadge";
import { splitIntoParagraphs } from "../utils/strings";

export function AccordionSection(props: {
  title: string;
  items: AnalysisSectionItem[];
  icon?: LucideIcon;
}): JSX.Element | null {
  const { items /*, icon: Icon*/ } = props;
  if (!items.length) {
    return null;
  }

  return (
    <section className="card accordion accordion-open" data-card-surface="true">
      <ul className="card-body">
        {items.map((item, index) => (
          <li key={`section-item-${index}`} className="card-item">
            <CardSection
              className="card-item-section"
              title={item.title}
              actions={
                item.severity || typeof item.score === "number" ? (
                  <SeverityBadge severity={item.severity} score={item.score} />
                ) : undefined
              }
            >
              {item.description &&
                splitIntoParagraphs(item.description).map((para, pIndex) => {
                  const trimmed = para.trim();
                  const nextStepsMatch = /^Next\s+Steps:\s*(.*)$/i.exec(trimmed);
                  if (nextStepsMatch) {
                    const rest = nextStepsMatch[1];
                    return (
                      <p key={`section-desc-${index}-${pIndex}`} className="card-item-description card-item-next-steps">
                        <strong className="next-steps-label">Next Steps:</strong>{rest ? ` ${rest}` : ""}
                      </p>
                    );
                  }
                  const isObservationGap = /^Observation\s+gap:/i.test(trimmed);
                  return (
                    <p
                      key={`section-desc-${index}-${pIndex}`}
                      className={`card-item-description${isObservationGap ? " observation-gap" : ""}`}
                    >
                      {para}
                    </p>
                  );
                })}
            </CardSection>
          </li>
        ))}
      </ul>
    </section>
  );
}
