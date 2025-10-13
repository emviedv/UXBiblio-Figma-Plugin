import type { AnalysisSectionItem } from "../../utils/analysis";
import { Badge } from "../primitives/Badge";

interface ParsedPsychologyItem {
  stage?: string;
  summary: string[];
  signals: string[];
  guardrailRecommendations: string[];
}

export function ProductPsychologyTab({ items }: { items: AnalysisSectionItem[] }): JSX.Element | null {
  if (!items.length) {
    return null;
  }

  return (
    <div className="tab-surface psychology-tab" data-ux-tab="psychology">
      {items.map((item, index) => {
        const parsed = parsePsychologyDescription(item.description ?? "");
        return (
          <article key={`psychology-item-${index}`} className="psychology-card" data-card-surface="true">
            <header className="psychology-card-header">
              <h3 className="psychology-card-title">{item.title}</h3>
              <div className="psychology-card-badges">
                {parsed.stage ? (
                  <Badge tone="stage" data-ux-section="psychology-stage">
                    {parsed.stage}
                  </Badge>
                ) : null}
              </div>
            </header>
            <div className="psychology-card-body">
              {parsed.summary.length > 0 ? (
                parsed.summary.map((paragraph, pIndex) => (
                  <p key={`psychology-summary-${index}-${pIndex}`} className="psychology-summary">
                    {paragraph}
                  </p>
                ))
              ) : (
                <p className="psychology-summary is-empty">No summary captured.</p>
              )}

              {parsed.signals.length > 0 ? (
                <div className="psychology-section">
                  <p className="psychology-section-title">Signals</p>
                  <ul className="psychology-list" data-ux-section="psychology-signals">
                    {parsed.signals.map((signal, signalIndex) => (
                      <li key={`psychology-signal-${index}-${signalIndex}`}>{signal}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {parsed.guardrailRecommendations.length > 0 ? (
                <div className="psychology-section">
                  <p className="psychology-section-title">Guardrail Recommendations</p>
                  <ul className="psychology-list" data-ux-section="psychology-guardrails">
                    {parsed.guardrailRecommendations.map((rec, recIndex) => (
                      <li key={`psychology-guardrail-${index}-${recIndex}`}>{rec}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function parsePsychologyDescription(description: string): ParsedPsychologyItem {
  if (!description) {
    return { summary: [], signals: [], guardrailRecommendations: [] };
  }

  const lines = description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const summary: string[] = [];
  const signals: string[] = [];
  const guardrailRecommendations: string[] = [];

  let stage: string | undefined;
  let currentSection: "summary" | "signals" | "guardrailRecommendations" = "summary";
  let guardrailLine: string | undefined;

  for (const line of lines) {
    if (/^Stage:/i.test(line)) {
      stage = toTitleCase(line.replace(/^Stage:\s*/i, ""));
      continue;
    }
    if (/^Guardrail:/i.test(line)) {
      guardrailLine = line.replace(/^Guardrail:\s*/i, "");
      continue;
    }
    if (/^Signals?\b/i.test(line)) {
      currentSection = "signals";
      continue;
    }
    if (/^Guardrail\s+Recommendations?\b/i.test(line)) {
      currentSection = "guardrailRecommendations";
      continue;
    }
    if (line.startsWith("-")) {
      const value = line.replace(/^-+\s*/, "").trim();
      if (currentSection === "signals") {
        signals.push(value);
      } else if (currentSection === "guardrailRecommendations") {
        guardrailRecommendations.push(value);
      } else {
        summary.push(value);
      }
      continue;
    }
    if (/^Next\s+Steps?:/i.test(line)) {
      currentSection = "guardrailRecommendations";
      const remainder = line.replace(/^Next\s+Steps?:\s*/i, "").trim();
      if (remainder) {
        guardrailRecommendations.push(remainder);
      }
      continue;
    }
    if (currentSection === "signals") {
      signals.push(line);
      continue;
    }
    if (currentSection === "guardrailRecommendations") {
      guardrailRecommendations.push(line);
      continue;
    }
    summary.push(line);
  }

  if (guardrailLine && guardrailRecommendations.length === 0) {
    guardrailRecommendations.push(guardrailLine);
  }

  return { stage, summary, signals, guardrailRecommendations };
}

function toTitleCase(value: string): string {
  if (!value) {
    return value;
  }
  return value
    .split(/\s+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
