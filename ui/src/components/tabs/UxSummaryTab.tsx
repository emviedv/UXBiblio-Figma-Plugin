import { useMemo } from "react";
import type { AnalysisSource } from "../../utils/analysis";
import { splitIntoParagraphs } from "../../utils/strings";
import { CollapsibleCard } from "../CollapsibleCard";
import { CardSection } from "../CardSection";
import { FacetGroup } from "../primitives/FacetGroup";
import { SourceList } from "../SourceList";

interface SummaryMeta {
  flows: string[];
  industries: string[];
  uiElements: string[];
  psychologyTags: string[];
  suggestedTitle?: string;
  suggestedTags?: string[];
  confidence?: { level?: string; rationale?: string };
  obsCount?: number;
}

export function UxSummaryTab({
  summary,
  scopeNote,
  receipts,
  meta,
  suggestions,
  uxSignals
}: {
  summary?: string;
  scopeNote?: string;
  receipts: AnalysisSource[];
  meta: SummaryMeta;
  suggestions: string[];
  uxSignals: string[];
}): JSX.Element {
  const summaryParagraphs = useMemo(() => {
    const seen = new Set<string>();
    const inputs = [scopeNote, summary];
    const collected: string[] = [];

    for (const block of inputs) {
      if (!block) continue;
      const paragraphs = splitIntoParagraphs(block)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .filter((line) => !/^(title|description)\s*(?:[:\-–—]|$)/i.test(line));

      for (const paragraph of paragraphs) {
        const signature = paragraph.replace(/\s+/g, " ").toLowerCase();
        if (seen.has(signature)) {
          continue;
        }
        seen.add(signature);
        collected.push(paragraph);
      }
    }

    return collected;
  }, [scopeNote, summary]);

  const topSuggestions = useMemo(() => suggestions.slice(0, 3), [suggestions]);
  const trimmedSignals = useMemo(() => {
    if (!Array.isArray(uxSignals)) {
      return [];
    }
    return uxSignals
      .map((signal) => (typeof signal === "string" ? signal.trim() : ""))
      .filter((signal) => signal.length > 0);
  }, [uxSignals]);

  const hasFacets =
    meta.flows.length > 0 ||
    meta.industries.length > 0 ||
    meta.uiElements.length > 0 ||
    meta.psychologyTags.length > 0;

  const hasMetaDetails =
    Boolean(meta.confidence?.level) ||
    typeof meta.obsCount === "number" ||
    (meta.suggestedTags?.length ?? 0) > 0;

  return (
    <div
      className="tab-surface summary-tab"
      data-ux-tab="summary"
      role="region"
      aria-labelledby="analysis-tab-ux-summary"
    >
      <CollapsibleCard className="summary-card" bodyClassName="summary-content">
        <CardSection className="summary-overview-section">
          <div className="summary-overview-body" data-ux-section="summary-overview">
            {summaryParagraphs.length > 0 ? (
              summaryParagraphs.map((line, index) => (
                <p key={`summary-overview-${index}`} className="summary-paragraph">
                  {line}
                </p>
              ))
            ) : (
              <p className="summary-paragraph is-empty">No summary provided.</p>
            )}
          </div>
        </CardSection>

        {trimmedSignals.length > 0 ? (
          <CardSection title="UX Signals" className="summary-signals-section">
            <ul className="summary-signals-list" data-ux-section="summary-signals">
              {trimmedSignals.map((signal, index) => (
                <li key={`summary-signal-${index}`}>{signal}</li>
              ))}
            </ul>
          </CardSection>
        ) : null}

        {hasFacets ? (
          <CardSection title="Facets" className="summary-facets-section">
            <div className="summary-facets-grid">
              <FacetGroup title="Flows" items={meta.flows} facetKey="flows" />
              <FacetGroup title="Industries" items={meta.industries} facetKey="industries" />
              <FacetGroup title="UI Elements" items={meta.uiElements} facetKey="ui-elements" />
              <FacetGroup title="Psychology" items={meta.psychologyTags} facetKey="psychology" />
            </div>
          </CardSection>
        ) : null}

        {hasMetaDetails ? (
          <CardSection title="Analysis Details" className="summary-meta-section">
            <dl className="summary-meta-list">
              {typeof meta.obsCount === "number" ? (
                <div className="summary-meta-item">
                  <dt>Observations</dt>
                  <dd>{meta.obsCount}</dd>
                </div>
              ) : null}
              {meta.confidence?.level ? (
                <div className="summary-meta-item">
                  <dt>Confidence</dt>
                  <dd>
                    {meta.confidence.level}
                    {meta.confidence.rationale ? (
                      <span className="summary-meta-footnote"> — {meta.confidence.rationale}</span>
                    ) : null}
                  </dd>
                </div>
              ) : null}
              {(meta.suggestedTags?.length ?? 0) > 0 ? (
                <div className="summary-meta-item">
                  <dt>Suggested Tags</dt>
                  <dd>{meta.suggestedTags?.join(", ")}</dd>
                </div>
              ) : null}
            </dl>
          </CardSection>
        ) : null}

        {topSuggestions.length > 0 ? (
          <CardSection
            title="High-Impact Copy Opportunities"
            className="summary-suggestions-section"
          >
            <ul className="summary-suggestions-list">
              {topSuggestions.map((suggestion, index) => (
                <li key={`summary-suggestion-${index}`}>{suggestion}</li>
              ))}
            </ul>
          </CardSection>
        ) : null}

        {receipts.length > 0 ? (
          <SourceList
            heading="Sources"
            sources={receipts}
            className="summary-sources summary-sources-list"
          />
        ) : null}
      </CollapsibleCard>
    </div>
  );
}
