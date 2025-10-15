import { useMemo } from "react";
import { Eye } from "lucide-react";
import type { AnalysisSource } from "../utils/analysis";
import { CollapsibleCard } from "./CollapsibleCard";
import { CardSection } from "./CardSection";
import { SourceList } from "./SourceList";
import { splitIntoParagraphs } from "../utils/strings";

type SummaryMeta = {
  contentType?: string;
  flows?: string[];
  industries?: string[];
  uiElements?: string[];
  psychologyTags?: string[];
  suggestedTitle?: string;
  suggestedTags?: string[];
  suggestedCollection?: string;
  confidence?: { level?: string; rationale?: string };
  obsCount?: number;
};

interface SummaryCardProps {
  summary?: string;
  receipts: AnalysisSource[];
  meta?: SummaryMeta;
  suggestions?: string[];
}

export function SummaryCard({ summary, receipts, suggestions }: SummaryCardProps): JSX.Element | null {
  const hasSummary = typeof summary === "string" && summary.trim().length > 0;
  const summaryLines = useMemo(() => {
    if (!hasSummary || !summary) {
      return [];
    }

    return splitIntoParagraphs(summary);
  }, [hasSummary, summary]);
  const topSuggestions = useMemo(() => {
    if (!Array.isArray(suggestions)) return [] as string[];
    const cleaned = suggestions
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter((s) => s.length > 0);
    return cleaned.slice(0, 3);
  }, [suggestions]);

  if (!hasSummary && receipts.length === 0) {
    return null;
  }

  return (
    <CollapsibleCard title="Key Highlights" icon={Eye} className="summary-card" bodyClassName="summary-content">
      {/* Per Guardrails: omit normalization/classification metadata from tab content */}
      {summaryLines.length > 0 && (
        <CardSection title="Highlights">
          <div className="summary-text">
            {summaryLines.map((line, index) => (
              <p key={`summary-line-${index}`}>{line}</p>
            ))}
          </div>
        </CardSection>
      )}
      {topSuggestions.length > 0 && (
        <CardSection title="Suggestions">
          <ul className="copywriting-guidance">
            {topSuggestions.map((s, i) => (
              <li key={`summary-suggestion-${i}`}>{s}</li>
            ))}
          </ul>
        </CardSection>
      )}
      <SourceList heading="Sources" sources={receipts} className="summary-sources" />
    </CollapsibleCard>
  );
}
