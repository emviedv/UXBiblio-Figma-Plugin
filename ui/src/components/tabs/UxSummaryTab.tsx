import { useMemo } from "react";
import type { AnalysisSource } from "../../utils/analysis";
import { splitIntoParagraphs } from "../../utils/strings";
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
  receipts,
  meta,
  suggestions
}: {
  summary?: string;
  receipts: AnalysisSource[];
  meta: SummaryMeta;
  suggestions: string[];
}): JSX.Element {
  const summaryParagraphs = useMemo(
    () => splitIntoParagraphs(summary ?? "").filter((line) => line.trim().length > 0),
    [summary]
  );

  const topSuggestions = useMemo(() => suggestions.slice(0, 3), [suggestions]);

  const hasFacets =
    meta.flows.length > 0 ||
    meta.industries.length > 0 ||
    meta.uiElements.length > 0 ||
    meta.psychologyTags.length > 0;

  const hasMetaDetails =
    Boolean(meta.suggestedTitle) ||
    Boolean(meta.confidence?.level) ||
    typeof meta.obsCount === "number" ||
    (meta.suggestedTags?.length ?? 0) > 0;

  return (
    <div className="tab-surface summary-tab" data-ux-tab="summary">
      <section
        className="summary-overview-card"
        aria-labelledby="summary-heading"
        data-card-surface="true"
      >
        <header className="summary-overview-header">
          <h2 id="summary-heading" data-ux-section="summary-heading">
            UX Analysis Summary
          </h2>
          {meta.suggestedTitle ? (
            <p className="summary-subtitle" data-ux-section="summary-subtitle">
              {meta.suggestedTitle}
            </p>
          ) : null}
        </header>
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
        {hasFacets ? (
          <section className="summary-facets" aria-label="Facets">
            <h3 className="summary-section-title">Facets</h3>
            <div className="summary-facets-grid">
              <FacetGroup title="Flows" items={meta.flows} facetKey="flows" />
              <FacetGroup title="Industries" items={meta.industries} facetKey="industries" />
              <FacetGroup title="UI Elements" items={meta.uiElements} facetKey="ui-elements" />
              <FacetGroup title="Psychology" items={meta.psychologyTags} facetKey="psychology" />
            </div>
          </section>
        ) : null}
      </section>

      {hasMetaDetails ? (
        <section className="summary-meta" aria-label="Analysis details" data-card-surface="true">
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
        </section>
      ) : null}

      {topSuggestions.length > 0 ? (
        <section
          className="summary-suggestions"
          aria-label="High-Impact Copy Opportunities"
          data-card-surface="true"
        >
          <h3 className="summary-section-title">High-Impact Copy Opportunities</h3>
          <ul className="summary-suggestions-list">
            {topSuggestions.map((suggestion, index) => (
              <li key={`summary-suggestion-${index}`}>{suggestion}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {receipts.length > 0 ? (
        <section className="summary-sources" aria-label="Sources" data-card-surface="true">
          <SourceList heading="Sources" sources={receipts} className="summary-sources-list" />
        </section>
      ) : null}
    </div>
  );
}
