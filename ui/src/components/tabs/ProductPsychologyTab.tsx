import type { AnalysisSectionItem } from "../../utils/analysis";
import { logger } from "@shared/utils/logger";
import { CollapsibleCard } from "../CollapsibleCard";
import { CardSection } from "../CardSection";
import { SeverityBadge } from "../SeverityBadge";
import { Badge } from "../primitives/Badge";
import { isDebugFixEnabled } from "../../utils/debugFlags";

interface ParsedPsychologyItem {
  summary: string[];
  signals: string[];
  guardrailRecommendations: string[];
}

export function ProductPsychologyTab({ items }: { items: AnalysisSectionItem[] }): JSX.Element | null {
  if (!items.length) {
    return null;
  }

  const debugLayoutEnabled = isDebugFixEnabled();
  if (debugLayoutEnabled) {
    logger.debug("[UI][DebugFix][PsychologyLayout] Rendering psychology insights with shared card layout", {
      itemCount: items.length
    });
  }

  return (
    <div className="tab-surface psychology-tab" data-ux-tab="psychology">
      <CollapsibleCard
        className="psychology-card"
        bodyElement="ul"
      >
        {items.map((item, index) => {
          const rawDescription = item.description ?? "";
          const parsed = parsePsychologyDescription(rawDescription);
          const metadataChips = buildPsychologyMetadataChips(item.metadata);
          const hasSummary = parsed.summary.length > 0;
          const hasSignals = parsed.signals.length > 0;
          const hasGuardrails = parsed.guardrailRecommendations.length > 0;

          if (debugLayoutEnabled) {
            logger.debug("[UI][DebugFix][PsychologyLayout] Card section snapshot", {
              index,
              title: item.title,
              metadataChipCount: metadataChips.length,
              summaryCount: parsed.summary.length,
              signalCount: parsed.signals.length,
              guardrailRecommendationCount: parsed.guardrailRecommendations.length,
              hasSeverity: Boolean(item.severity),
              hasScore: typeof item.score === "number"
            });

            const trimmed = rawDescription.trim();
            const hasSignalsInline = /\bSignals\s*:/i.test(trimmed);
            const hasNextStepsInline = /\bNext\s+Steps?\s*:/i.test(trimmed);
            if (trimmed && !hasSummary && !hasSignals && !hasGuardrails) {
              logger.debug("[UI][Psychology][Diagnostics] Summary missing after parse", {
                index,
                title: item.title,
                hasSignalsInline,
                hasNextStepsInline,
                rawLines: trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
              });
            }
            if (hasSignalsInline && parsed.signals.length === 0) {
              logger.debug("[UI][Psychology][Diagnostics] Signals collapsed by inline format", {
                index,
                title: item.title
              });
            }
          }

          return (
            <li key={`psychology-item-${index}`} className="card-item">
              <CardSection
                title={item.title}
                actions={
                  item.severity || typeof item.score === "number" ? (
                    <SeverityBadge severity={item.severity} score={item.score} />
                  ) : undefined
                }
              >
                <div className="psychology-section-content">
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
                  {hasSummary
                    ? parsed.summary.map((paragraph, pIndex) => (
                        <p key={`psychology-summary-${index}-${pIndex}`} className="psychology-summary">
                          {paragraph}
                        </p>
                      ))
                    : null}
                  {!hasSummary && !hasSignals && !hasGuardrails ? (
                    <p className="psychology-summary is-empty">No summary captured.</p>
                  ) : null}

                  {hasSignals ? (
                    <div className="psychology-section">
                      <p className="psychology-section-title">Signals</p>
                      <ul className="psychology-list" data-ux-section="psychology-signals">
                        {parsed.signals.map((signal, signalIndex) => (
                          <li key={`psychology-signal-${index}-${signalIndex}`}>{signal}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {hasGuardrails ? (
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
              </CardSection>
            </li>
          );
        })}
      </CollapsibleCard>
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
    const signalsInline = line.match(/^Signals?\s*[:\-–—]\s*(.+)$/i);
    if (signalsInline) {
      currentSection = "signals";
      pushDelimitedValues(signals, signalsInline[1]);
      continue;
    }
    const guardrailInline = line.match(/^Guardrail\s+Recommendations?\s*[:\-–—]\s*(.+)$/i);
    if (guardrailInline) {
      currentSection = "guardrailRecommendations";
      pushDelimitedValues(guardrailRecommendations, guardrailInline[1]);
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

function pushDelimitedValues(target: string[], text: string): void {
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }

  const tokens = trimmed
    .split(/[,;•\u2022]/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    target.push(trimmed);
    return;
  }

  if (tokens.length === 1) {
    target.push(tokens[0]);
    return;
  }

  target.push(...tokens);
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
