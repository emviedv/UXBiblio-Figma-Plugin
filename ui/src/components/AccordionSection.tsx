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
              {item.description ? (
                (() => {
                  const { paragraphs, nextSteps } = parseHeuristicDescription(item.description!);
                  return (
                    <>
                      {paragraphs.map((para, pIndex) => {
                        const isObservationGap = /^Observation\s+gap:/i.test(para.trim());
                        return (
                          <p
                            key={`section-desc-${index}-${pIndex}`}
                            className={`card-item-description${isObservationGap ? " observation-gap" : ""}`}
                          >
                            {para}
                          </p>
                        );
                      })}
                      {nextSteps.length > 0 ? (
                        <div className="card-item-next-steps">
                          <p className="next-steps-label">Next Steps</p>
                          <ul className="card-item-list">
                            {nextSteps.map((step, sIndex) => (
                              <li key={`section-next-${index}-${sIndex}`}>{step}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </>
                  );
                })()
              ) : null}
            </CardSection>
          </li>
        ))}
      </ul>
    </section>
  );
}

function parseHeuristicDescription(description: string): { paragraphs: string[]; nextSteps: string[] } {
  const lines = splitIntoParagraphs(description)
    .flatMap((p) => p.split(/\r?\n/))
    .map((l) => l.trim())
    .filter(Boolean);

  const paragraphs: string[] = [];
  const nextSteps: string[] = [];
  let mode: "body" | "next" = "body";

  for (const line of lines) {
    const mNext = /^Next\s+Steps\s*[:\-–—]?\s*(.*)$/i.exec(line);
    if (mNext) {
      mode = "next";
      const remainder = (mNext[1] || "").trim();
      if (remainder) pushDelimited(remainder, nextSteps);
      continue;
    }

    if (mode === "next") {
      // Accept bullet or delimited follow-ups as steps
      const bullet = /^[-•]\s*(.+)$/.exec(line);
      if (bullet) {
        const v = bullet[1].trim();
        if (v) nextSteps.push(v);
        continue;
      }
      pushDelimited(line, nextSteps);
      continue;
    }

    paragraphs.push(line);
  }

  return { paragraphs, nextSteps };
}

function pushDelimited(value: string, bucket: string[]): void {
  const parts = value
    .split(/(?:;\s*|•\s*|·\s*|\u2022\s*)/)
    .map((s) => s.trim())
    .filter(Boolean);
  bucket.push(...parts);
}
