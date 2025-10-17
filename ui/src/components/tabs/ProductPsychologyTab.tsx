import type { AnalysisSectionItem } from "../../utils/analysis";
import { Badge } from "../primitives/Badge";

interface ParsedPsychologyItem {
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
        const severityLabel = formatSeverity(item.severity);
        const metadataChips = buildPsychologyMetadataChips(item.metadata);
        return (
          <article key={`psychology-item-${index}`} className="psychology-card" data-card-surface="true">
            <header className="psychology-card-header">
              <h3 className="psychology-card-title">
                {item.title}
                {severityLabel ? <span className="psychology-card-severity"> — {severityLabel}</span> : null}
              </h3>
            </header>
            <div className="psychology-card-body">
              {metadataChips.length > 0 ? (
                <div className="recommendation-meta psychology-meta">
                  {metadataChips.map((chip, chipIndex) => (
                    <Badge
                      key={`psychology-chip-${index}-${chipIndex}`}
                      tone={chip.tone}
                      data-psych-chip={chip.type}
                      aria-label={`${chip.label} ${chip.value}`}
                    >
                      {`${chip.label} ${chip.value}`}
                    </Badge>
                  ))}
                </div>
              ) : null}
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

  let currentSection: "summary" | "signals" | "guardrailRecommendations" = "summary";
  let guardrailLine: string | undefined;

  for (const line of lines) {
    if (/^Stage:/i.test(line)) {
      continue;
    }
    if (/^Intent:/i.test(line)) {
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

  return { summary, signals, guardrailRecommendations };
}

function formatSeverity(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed
    .split(/\s+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function buildPsychologyMetadataChips(
  metadata: Record<string, string | string[]> | undefined
): Array<{ type: string; label: string; value: string; tone: string }> {
  if (!metadata) {
    return [];
  }

  const chips: Array<{ type: string; label: string; value: string; tone: string }> = [];

  const intent = extractMetadataValue(metadata, "intent");
  if (intent) {
    chips.push({ type: "intent", label: "Intent", value: intent, tone: "intent" });
  }

  const guardrails = extractMetadataArray(metadata, "guardrail");
  guardrails.forEach((guardrail) => {
    chips.push({
      type: "guardrail",
      label: "Guardrail",
      value: guardrail,
      tone: "guardrail"
    });
  });

  return chips;
}

function extractMetadataValue(metadata: Record<string, string | string[]>, key: string): string | undefined {
  const value = metadata[key];
  if (Array.isArray(value)) {
    const first = value.find((entry) => entry.trim().length > 0);
    return first ? titleCase(first) : undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? titleCase(trimmed) : undefined;
  }
  return undefined;
}

function extractMetadataArray(metadata: Record<string, string | string[]>, key: string): string[] {
  const value = metadata[key];
  if (Array.isArray(value)) {
    return value.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((segment) => (segment ? segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase() : ""))
    .join(" ")
    .trim();
}
