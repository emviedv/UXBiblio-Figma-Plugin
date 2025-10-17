import { useMemo } from "react";
import { Frame, Type } from "lucide-react";
import type { CopywritingContent } from "../utils/analysis";
import type { CopywritingSection } from "../utils/copywritingSections";
import { CollapsibleCard } from "./CollapsibleCard";
import { CardSection } from "./CardSection";
import { SourceList } from "./SourceList";

export function CopywritingCard({
  copywriting,
  tabLabel = "UX Copy",
  sections = []
}: {
  copywriting: CopywritingContent;
  tabLabel?: string;
  sections?: CopywritingSection[];
}): JSX.Element | null {
  const hasSources = copywriting.sources.length > 0;
  const rawHeading = copywriting.heading?.trim();
  const hasHeading = Boolean(rawHeading);

  const normalizedTabLabel = tabLabel.trim().toLowerCase();
  const normalizedHeading = rawHeading?.toLowerCase();
  const cardTitle =
    rawHeading && normalizedHeading && normalizedHeading !== normalizedTabLabel
      ? rawHeading
      : "Copy Guidance";

  const effectiveSections = useMemo(() => {
    if (!Array.isArray(sections)) {
      return [];
    }
    return sections.filter((section) => {
      const paragraphs = Array.isArray(section.paragraphs) ? section.paragraphs.filter(Boolean) : [];
      const bullets = Array.isArray(section.bullets) ? section.bullets.filter(Boolean) : [];
      return paragraphs.length > 0 || bullets.length > 0;
    });
  }, [sections]);

  const hasSections = effectiveSections.length > 0;

  if (!hasSections && !hasHeading && !hasSources) {
    return null;
  }

  const showFallbackSummary = hasHeading && !hasSections;

  return (
    <CollapsibleCard title={cardTitle} icon={Type} className="copywriting-card" bodyClassName="copywriting-content">
      {effectiveSections.map((section) => {
        const paragraphs = Array.isArray(section.paragraphs) ? section.paragraphs.filter(Boolean) : [];
        const bullets = Array.isArray(section.bullets) ? section.bullets.filter(Boolean) : [];
        return (
          <CardSection
            key={section.id}
            title={section.title}
            data-copywriting-section={section.id}
          >
            {paragraphs.length > 0 ? (
              <div className="copywriting-summary">
                {paragraphs.map((line, index) => (
                  <p key={`${section.id}-paragraph-${index}`}>{line}</p>
                ))}
              </div>
            ) : null}
            {bullets.length > 0 ? (
              <ul className="copywriting-guidance">
                {bullets.map((item, index) => (
                  <li key={`${section.id}-bullet-${index}`}>{item}</li>
                ))}
              </ul>
            ) : null}
          </CardSection>
        );
      })}
      {showFallbackSummary && (
        <CardSection title="Summary">
          <div className="copywriting-summary" data-empty="true">
            <p>
              <Frame className="copywriting-empty-icon" aria-hidden="true" /> Copy guidance is limited to the heading
              above; the analysis returned no additional summary or action items.
            </p>
          </div>
        </CardSection>
      )}
      <SourceList heading="Sources" sources={copywriting.sources} className="copywriting-sources" />
    </CollapsibleCard>
  );
}
