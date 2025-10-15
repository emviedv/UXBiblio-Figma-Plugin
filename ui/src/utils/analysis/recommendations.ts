import type { AccessibilityExtras, AnalysisSectionItem } from "./types";
import { asString, asStringArray, mergeUniqueStrings } from "./strings";
import { logger } from "@shared/utils/logger";

const FOOTER_LABELS = ["Validation", "Rationale", "Evidence", "Observation", "Outcome", "Note"] as const;
const PRIORITY_TAGS: Record<string, string> = {
  immediate: "[Immediate]",
  "immediate actions": "[Immediate]",
  "long-term": "[Long-term]",
  "long term": "[Long-term]",
  longterm: "[Long-term]"
};

const findClosingBracketIndex = (value: string, startIndex: number): number => {
  let depth = 0;
  for (let index = startIndex; index < value.length; index += 1) {
    const char = value[index];
    if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
};

const stripBracketedMetaBlocks = (value: string): string => {
  if (!value.includes("[")) {
    return value;
  }

  let output = "";
  let index = 0;
  while (index < value.length) {
    const char = value[index];
    if (char === "[") {
      const closingIndex = findClosingBracketIndex(value, index);
      if (closingIndex === -1) {
        logger.warn("[Recommendations][sanitize] Unmatched bracket while stripping metadata", {
          snippet: value.slice(index, index + 80)
        });
        output += value.slice(index);
        break;
      }

      const inside = value.slice(index + 1, closingIndex);
      if (inside.includes(":")) {
        const [rawLabel, ...rest] = inside.split(":");
        const canonical = PRIORITY_TAGS[rawLabel.trim().toLowerCase()];
        if (canonical) {
          output += canonical;
          const remainder = rest.join(":").trim();
          if (remainder.length > 0) {
            output += ` ${remainder}`;
          }
        }
        index = closingIndex + 1;
        continue;
      }

      logger.debug("[Recommendations][sanitize] Preserving bracketed block without colon", { inside });
      output += value.slice(index, closingIndex + 1);
      index = closingIndex + 1;
      continue;
    }

    output += char;
    index += 1;
  }

  return output;
};

const extractFooters = (value: string): { summary: string; footers: string[] } => {
  let remaining = value;
  const footers: string[] = [];
  let matched = true;

  while (matched) {
    matched = false;
    for (const label of FOOTER_LABELS) {
      const pattern = new RegExp(`${label}\\s*[:\\-—]\\s*(.+)$`, "i");
      const match = pattern.exec(remaining);
      if (!match) continue;

      const footerValue = (match[1] || "").trim();
      if (footerValue) {
        footers.unshift(`${label}: ${footerValue}`);
      }

      remaining = remaining.slice(0, match.index).trim();
      matched = true;
      break;
    }
  }

  return { summary: remaining, footers };
};

export const sanitizeRecommendationText = (raw: string): string => {
  if (!raw) {
    return "";
  }

  let output = stripBracketedMetaBlocks(raw).replace(/^[\s,;\]]+/, "");
  output = output.replace(/^impact:[^\]]*(?:\]|$)/i, "");
  const { summary, footers } = extractFooters(output.trim());

  const cleanedSummary = summary
    .replace(/^[\s,;\]]+/, "")
    .replace(/[\s\t\u00A0]{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();

  if (!cleanedSummary && footers.length === 0) {
    logger.debug("[Recommendations][sanitize] Dropped recommendation after sanitization", {
      preview: raw.slice(0, 80)
    });
    return "";
  }

  if (footers.length === 0) {
    return cleanedSummary;
  }

  return [cleanedSummary, ...footers].filter(Boolean).join(" ").trim();
};


export function normalizeRecommendations(recommendations: unknown): string[] {
  if (Array.isArray(recommendations)) {
    const sanitized = recommendations
      .filter((item): item is string => typeof item === "string")
      .map((item) => sanitizeRecommendationText(item))
      .filter((item) => item.length > 0);
    return Array.from(new Set(sanitized));
  }

  if (!recommendations || typeof recommendations !== "object") {
    return [];
  }

  const record = recommendations as Record<string, unknown>;
  const priority = asString(record["priority"]);
  const immediate = asStringArray(record["immediate"]).map((text) => `[Immediate] ${text}`);
  const longTerm = asStringArray(record["longTerm"]).map((text) => `[Long-term] ${text}`);

  const combined = [...immediate, ...longTerm]
    .map((item) => sanitizeRecommendationText(item))
    .filter((item) => item.length > 0);

  if (priority) {
    const sanitizedPriority = sanitizeRecommendationText(`Overall priority: ${priority}`);
    if (sanitizedPriority) {
      combined.unshift(sanitizedPriority);
    }
  }

  return Array.from(new Set(combined));
}

export function collectRecommendations(args: {
  base: string[];
  psychology: AnalysisSectionItem[];
  impact: AnalysisSectionItem[];
  heuristics: AnalysisSectionItem[];
  accessibilityExtras: AccessibilityExtras;
}): string[] {
  const { base, psychology, impact, heuristics, accessibilityExtras } = args;
  const recapFromPsych = extractNextStepsFromItems(psychology);
  const recapFromImpact = extractNextStepsFromItems(impact);
  const recapFromHeuristics = extractNextStepsFromItems(heuristics);
  const recapFromA11yExtras = accessibilityExtras.recommendations ?? [];

  const merged = mergeUniqueStrings([
    base.map(sanitizeRecommendationText),
    recapFromPsych,
    recapFromImpact,
    recapFromHeuristics,
    (recapFromA11yExtras as string[]).map((entry) => sanitizeRecommendationText(String(entry)))
  ]);

  return merged.map((entry) => sanitizeRecommendationText(entry)).filter((entry) => entry.length > 0);
}

function extractNextStepsFromItems(items: AnalysisSectionItem[]): string[] {
  const results: string[] = [];
  for (const item of items) {
    const desc = item.description;
    if (!desc) continue;
    for (const line of desc.split(/\r?\n/)) {
      const trimmed = line.trim();
      let payload: string | null = null;
      const mNext = /^Next\s+Steps:\s*(.*)$/i.exec(trimmed);
      const mRec = /^Recommendation:\s*(.*)$/i.exec(trimmed);
      if (mNext) payload = mNext[1] ?? "";
      if (!payload && mRec) payload = mRec[1] ?? "";
      if (!payload) continue;
      const parts = payload.split(/;\s+/);
      for (const p of parts) {
        const t = p.trim();
        if (t) {
          const sanitized = sanitizeRecommendationText(t);
          if (sanitized) {
            results.push(sanitized);
          }
        }
      }
    }
  }
  return results;
}
