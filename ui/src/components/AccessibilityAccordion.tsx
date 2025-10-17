import type { AccessibilityExtras, AnalysisSectionItem } from "../utils/analysis";
import { CardSection } from "./CardSection";
import { SeverityBadge } from "./SeverityBadge";
import { SourceList } from "./SourceList";
import { splitIntoParagraphs } from "../utils/strings";
import { Badge } from "./primitives/Badge";

export function AccessibilityAccordion({
  items,
  extras
}: {
  items: AnalysisSectionItem[];
  extras: AccessibilityExtras;
}): JSX.Element | null {
  const extrasContentAvailable =
    typeof extras.contrastScore === "number" ||
    Boolean(extras.summary && extras.summary.trim()) ||
    Boolean(extras.keyRecommendation && extras.keyRecommendation.trim()) ||
    extras.issues.length > 0 ||
    extras.recommendations.length > 0 ||
    extras.sources.length > 0;
  const hasItems = items.length > 0;

  if (!extrasContentAvailable && !hasItems) {
    return null;
  }

  return <AccessibilityAccordionPanel items={items} extras={extras} />;
}

function AccessibilityAccordionPanel({
  items,
  extras
}: {
  items: AnalysisSectionItem[];
  extras: AccessibilityExtras;
}): JSX.Element {
  const summaryParagraphs = splitIntoParagraphs(extras.summary ?? "");
  const keyRecommendationParagraphs = splitIntoParagraphs(extras.keyRecommendation ?? "");
  const hasContrastScore = typeof extras.contrastScore === "number";
  const hasContrastSummary =
    summaryParagraphs.length > 0 || Boolean(extras.contrastStatus && !hasContrastScore);
  const contrastDetails = deriveContrastSeverity(extras.contrastScore, extras.contrastStatus);
  const hasSources = extras.sources.length > 0;
  const hasGuardrails = extras.guardrails.length > 0;

  return (
    <section className="card accessibility-card" data-card-surface="true">
      <ul className="card-body">
        {(hasContrastScore || hasContrastSummary) && (
          <li className="card-item">
            <CardSection
              title="Overall Contrast"
              className="card-item-section accessibility-content"
              actions={
                contrastDetails.severity ? (
                  <SeverityBadge severity={contrastDetails.severity} />
                ) : undefined
              }
            >
              <div className="accessibility-overview">
                {hasContrastScore ? (
                  <div className="accessibility-contrast">
                    <span className="accessibility-contrast-label">Score</span>
                    <span className="accessibility-contrast-value">{formatContrastScore(extras.contrastScore)}</span>
                  </div>
                ) : null}
                {contrastDetails.label ? (
                  <p className="accessibility-contrast-note">{contrastDetails.label}</p>
                ) : null}
                {summaryParagraphs.map((para, idx) => (
                  <p key={`a11y-summary-${idx}`} className="accessibility-summary">
                    {para}
                  </p>
                ))}
              </div>
            </CardSection>
          </li>
        )}

        {keyRecommendationParagraphs.length > 0 && (
          <li className="card-item">
            <CardSection title="Key Recommendation" className="card-item-section accessibility-key">
              {keyRecommendationParagraphs.map((para, idx) => (
                <p key={`a11y-key-rec-${idx}`} className="card-item-description">
                  {para}
                </p>
              ))}
            </CardSection>
          </li>
        )}

        {hasGuardrails && (
          <li className="card-item">
            <CardSection title="Guardrails" className="card-item-section accessibility-guardrails">
              <div className="recommendation-meta" aria-label="Accessibility guardrails">
                {extras.guardrails.map((guardrail, index) => {
                  const label = guardrail.trim();
                  if (!label) {
                    return null;
                  }
                  return (
                    <Badge
                      key={`a11y-guardrail-${index}`}
                      tone="guardrail"
                      data-a11y-guardrail-chip="true"
                    >
                      {`Guardrail ${label}`}
                    </Badge>
                  );
                })}
              </div>
            </CardSection>
          </li>
        )}

        <li className="card-item">
          <CardSection title="Issues" className="card-item-section accessibility-section">
            {extras.issues.length > 0 ? (
              <ul className="accessibility-list">
                {extras.issues.map((issue, index) => (
                  <li key={`accessibility-issue-${index}`}>{issue}</li>
                ))}
              </ul>
            ) : (
              <p className="accessibility-empty">No issues detected.</p>
            )}
          </CardSection>
        </li>

        <li className="card-item">
          <CardSection title="Recommendations" className="card-item-section accessibility-section">
            {extras.recommendations.length > 0 ? (
              <ul className="accessibility-list">
                {extras.recommendations.map((item, index) => (
                  <li key={`accessibility-rec-${index}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="accessibility-empty">No follow-up recommendations.</p>
            )}
          </CardSection>
        </li>

        {hasSources && (
          <li className="card-item">
            <SourceList
              heading="Sources"
              sources={extras.sources}
              className="card-item-section accessibility-sources"
            />
          </li>
        )}

        {items.map((item, index) => (
          <li key={`accessibility-item-${index}`} className="card-item">
            <CardSection
              className="card-item-section"
              title={item.title}
              actions={
                item.severity || typeof item.score === "number" ? (
                  <SeverityBadge severity={item.severity} score={item.score} />
                ) : undefined
              }
            >
              {renderItemDetail(item.description, index)}
            </CardSection>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatContrastScore(score: number | undefined): string {
  if (typeof score !== "number" || Number.isNaN(score)) {
    return "—";
  }
  return `${Math.max(1, Math.min(5, Math.round(score)))}/5`;
}

function renderItemDetail(description: string | undefined, index: number): JSX.Element | null {
  if (!description) return null;
  const { paragraphs, checks, issues, recs } = parseA11yDescription(description);

  return (
    <div className="accessibility-section">
      {paragraphs.map((para, pIndex) => (
        <p key={`a11y-desc-${index}-${pIndex}`} className="card-item-description">
          {para}
        </p>
      ))}
      {checks.length > 0 && (
        <div className="accessibility-subsection">
          <p className="accessibility-subsection-title">Checks</p>
          <ul className="accessibility-list">
            {checks.map((c, i) => (
              <li key={`a11y-check-${index}-${i}`}>{c}</li>
            ))}
          </ul>
        </div>
      )}
      {issues.length > 0 && (
        <div className="accessibility-subsection">
          <p className="accessibility-subsection-title">Issues</p>
          <ul className="accessibility-list">
            {issues.map((it, i) => (
              <li key={`a11y-issue-${index}-${i}`}>{it}</li>
            ))}
          </ul>
        </div>
      )}
      {recs.length > 0 && (
        <div className="accessibility-subsection">
          <p className="accessibility-subsection-title">Next Steps</p>
          <ul className="accessibility-list">
            {recs.map((r, i) => (
              <li key={`a11y-rec-${index}-${i}`}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function parseA11yDescription(desc: string): {
  paragraphs: string[];
  checks: string[];
  issues: string[];
  recs: string[];
} {
  const paragraphs: string[] = [];
  let checks: string[] = [];
  let issues: string[] = [];
  let recs: string[] = [];

  const lines = desc.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const mChecks = /^Checks:\s*(.*)$/i.exec(line);
    const mIssues = /^Issues:\s*(.*)$/i.exec(line);
    const mRecs = /^(Recommendations|Next\s*Steps):\s*(.*)$/i.exec(line);
    if (mChecks) {
      checks = splitList(mChecks[1]);
      continue;
    }
    if (mIssues) {
      issues = splitList(mIssues[1]);
      continue;
    }
    if (mRecs) {
      recs = splitList(mRecs[2] ?? "");
      continue;
    }
    paragraphs.push(line);
  }

  return { paragraphs: paragraphs.length ? paragraphs : splitIntoParagraphs(desc), checks, issues, recs };
}

function splitList(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split(/;|,/) // semicolons or commas
    .map((s) => s.trim())
    .filter(Boolean);
}

function deriveContrastSeverity(
  score: number | undefined,
  status: string | undefined
): { severity?: string; label?: string } {
  if (typeof status === "string") {
    const normalizedStatus = status.trim().toLowerCase();
    if (normalizedStatus === "processing" || normalizedStatus === "pending") {
      return { severity: undefined, label: "Contrast check still processing." };
    }
  }

  if (typeof score !== "number" || Number.isNaN(score)) {
    return { severity: undefined, label: undefined };
  }

  if (score <= 2) {
    return { severity: "high", label: "High severity" };
  }
  if (score === 3) {
    return { severity: "medium", label: "Moderate severity" };
  }
  return { severity: "low", label: "Low severity" };
}
