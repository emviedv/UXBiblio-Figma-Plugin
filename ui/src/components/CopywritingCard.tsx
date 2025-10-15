import { useMemo } from "react";
import { Frame, Type } from "lucide-react";
import type { CopywritingContent } from "../utils/analysis";
import { CollapsibleCard } from "./CollapsibleCard";
import { CardSection } from "./CardSection";
import { SourceList } from "./SourceList";
import { splitIntoParagraphs } from "../utils/strings";

export function CopywritingCard({
  copywriting,
  tabLabel = "UX Copy"
}: {
  copywriting: CopywritingContent;
  tabLabel?: string;
}): JSX.Element | null {
  const hasSummary = typeof copywriting.summary === "string" && copywriting.summary.trim().length > 0;
  const hasGuidance = copywriting.guidance.length > 0;
  const hasSources = copywriting.sources.length > 0;
  const rawHeading = copywriting.heading?.trim();
  const hasHeading = Boolean(rawHeading);

  const summaryParagraphs = useMemo(() => {
    if (!hasSummary || !copywriting.summary) {
      return [];
    }

    return splitIntoParagraphs(copywriting.summary);
  }, [copywriting.summary, hasSummary]);

  const hasBodyContent =
    summaryParagraphs.length > 0 || hasGuidance || hasSources;

  if (!hasBodyContent && !hasHeading) {
    return null;
  }

  const normalizedTabLabel = tabLabel.trim().toLowerCase();
  const normalizedHeading = rawHeading?.toLowerCase();
  const cardTitle =
    rawHeading && normalizedHeading && normalizedHeading !== normalizedTabLabel
      ? rawHeading
      : "Copy Guidance";
  const showFallbackSummary = hasHeading && !hasBodyContent;

  return (
    <CollapsibleCard title={cardTitle} icon={Type} className="copywriting-card" bodyClassName="copywriting-content">
      {summaryParagraphs.length > 0 && (
        <CardSection title="Summary">
          <div className="copywriting-summary">
            {summaryParagraphs.map((line, index) => (
              <p key={`copywriting-summary-${index}`}>{line}</p>
            ))}
          </div>
        </CardSection>
      )}
      {hasGuidance && (
        <CardSection title="Guidance">
          <ul className="copywriting-guidance">
            {copywriting.guidance.map((item, index) => (
              <li key={`copywriting-guidance-${index}`}>{item}</li>
            ))}
          </ul>
        </CardSection>
      )}
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
