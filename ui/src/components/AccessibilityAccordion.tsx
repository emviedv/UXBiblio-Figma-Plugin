import type { AccessibilityExtras, AnalysisSectionItem } from "../utils/analysis";
import { classNames } from "../utils/classNames";
import { CardSection } from "./CardSection";
import { SeverityBadge } from "./SeverityBadge";
import { SourceList } from "./SourceList";
import { splitIntoParagraphs } from "../utils/strings";

export function AccessibilityAccordion({
  items,
  extras
}: {
  items: AnalysisSectionItem[];
  extras: AccessibilityExtras;
}): JSX.Element | null {
  const extrasContentAvailable =
    typeof extras.contrastScore === "number" ||
    (typeof extras.summary === "string" && extras.summary.trim().length > 0) ||
    (extras.issues?.length ?? 0) > 0 ||
    (extras.recommendations?.length ?? 0) > 0 ||
    (extras.sources?.length ?? 0) > 0;
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
  const {
    contrastScore,
    summary,
    issues = [],
    recommendations = [],
    sources = []
  } = extras;

  const hasContrast = typeof contrastScore === "number";
  const hasSummary = typeof summary === "string" && summary.trim().length > 0;
  const hasIssues = issues.length > 0;
  const hasRecommendations = recommendations.length > 0;
  const hasSources = sources.length > 0;

  return (
    <section className="card accessibility-card" data-card-surface="true">
      <ul className="card-body">
        {(hasIssues || hasRecommendations) && (
          <li className="card-item">
            <CardSection title="Issues & Next Steps" className="card-item-section accessibility-section">
              {hasIssues && (
                <div className="accessibility-subsection">
                  <p className="accessibility-subsection-title">Issues</p>
                  <ul className="accessibility-list">
                    {issues.map((issue, index) => (
                      <li key={`accessibility-issue-${index}`}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              {hasRecommendations && (
                <div className="accessibility-subsection">
                  <p className="accessibility-subsection-title">Next Steps</p>
                  <ul className="accessibility-list">
                    {recommendations.map((item, index) => (
                      <li key={`accessibility-rec-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardSection>
          </li>
        )}

        {(hasContrast || hasSummary) && (
          <li className="card-item">
            <CardSection title="Accessibility Overview" className="card-item-section accessibility-content">
              {hasContrast && typeof contrastScore === "number" && (
                <div className="accessibility-contrast">
                  <span className="accessibility-contrast-label">Contrast Score</span>
                  <span className={classNames("accessibility-contrast-value", contrastLevelClass(contrastScore))}>
                    {contrastScore}/5
                  </span>
                </div>
              )}
              {hasSummary &&
                splitIntoParagraphs(summary ?? "").map((para, idx) => (
                  <p key={`a11y-summary-${idx}`} className="accessibility-summary">
                    {para}
                  </p>
                ))}
            </CardSection>
          </li>
        )}

        {hasSources && (
          <li className="card-item">
            <SourceList heading="Sources" sources={sources} className="card-item-section accessibility-sources" />
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

function contrastLevelClass(score: number): string {
  if (score <= 1) {
    return "contrast-level-low";
  }
  if (score <= 3) {
    return "contrast-level-medium";
  }
  return "contrast-level-high";
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
