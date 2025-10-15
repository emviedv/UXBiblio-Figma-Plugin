import { logger } from "@shared/utils/logger";
import type { AnalysisSectionItem } from "./types";
import { asString, asStringArray, mergeDescription } from "./strings";
import { formatKeyAsTitle } from "./shared";
import { extractSeverity, parseScoreOrFallback } from "./numbers";

interface HeuristicCandidate {
  record: Record<string, unknown>;
  fallbackKey?: string;
}

const HEURISTICS_METADATA_KEYS = new Set([
  "summary",
  "overview",
  "notes",
  "sources",
  "meta",
  "metadata",
  "stats"
]);

const HEURISTICS_COLLECTION_KEYS = ["items", "entries", "list", "values", "heuristics"];

const CANONICAL_HEURISTICS: readonly string[] = [
  "Visibility of system status",
  "Match between system and the real world",
  "User control and freedom",
  "Consistency and standards",
  "Error prevention",
  "Recognition rather than recall",
  "Flexibility and efficiency of use",
  "Aesthetic and minimalist design",
  "Help users recognize, diagnose, and recover from errors",
  "Help and documentation"
];

const CANONICAL_HEURISTIC_LOOKUP = new Map(
  CANONICAL_HEURISTICS.map((name) => [normalizeHeuristicIdentifier(name), name])
);

export function normalizeHeuristics(section: unknown): AnalysisSectionItem[] {
  const candidates = collectHeuristicCandidates(section);
  if (candidates.length === 0) {
    if (section && typeof section === "object" && !Array.isArray(section)) {
      const keys = Object.keys(section as Record<string, unknown>);
      logger.debug("[AnalysisNormalizer][Heuristics] No iterable heuristics found", { keys });
    }
    return [];
  }

  const items: AnalysisSectionItem[] = [];

  for (const candidate of candidates) {
    const normalized = normalizeHeuristicCandidate(candidate);
    if (normalized) {
      items.push(normalized);
    }
  }

  return items;
}

export function ensureAllHeuristics(items: AnalysisSectionItem[]): AnalysisSectionItem[] {
  const canonicalMap = new Map<string, AnalysisSectionItem>();
  const nonCanonical: AnalysisSectionItem[] = [];

  for (const item of items) {
    const canonicalTitle = matchCanonicalHeuristic(item.title) ?? item.title;
    if (CANONICAL_HEURISTICS.includes(canonicalTitle)) {
      const existing = canonicalMap.get(canonicalTitle);
      canonicalMap.set(canonicalTitle, mergeHeuristicItems(existing, { ...item, title: canonicalTitle }));
    } else {
      nonCanonical.push(item);
    }
  }

  const results: AnalysisSectionItem[] = [];

  for (const canonical of CANONICAL_HEURISTICS) {
    const item = canonicalMap.get(canonical);
    results.push(item ?? { title: canonical });
  }

  if (nonCanonical.length) {
    results.push(...nonCanonical);
  }

  return results;
}

function collectHeuristicCandidates(section: unknown): HeuristicCandidate[] {
  const candidates: HeuristicCandidate[] = [];

  const pushArray = (value: unknown, fallbackKey?: string) => {
    if (!Array.isArray(value)) {
      return;
    }
    for (const item of value) {
      if (!item) {
        continue;
      }

      if (typeof item === "object") {
        const record = item as Record<string, unknown>;
        if (looksLikeHeuristicRecord(record)) {
          candidates.push({ record, fallbackKey });
        }
        continue;
      }

      if (typeof item === "string" && item.trim().length > 0) {
        candidates.push({ record: { description: item }, fallbackKey });
      }
    }
  };

  if (!section) {
    return candidates;
  }

  if (Array.isArray(section)) {
    pushArray(section);
    return candidates;
  }

  if (typeof section === "string") {
    const trimmed = section.trim();
    if (trimmed) {
      candidates.push({ record: { description: trimmed } });
    }
    return candidates;
  }

  if (typeof section !== "object") {
    return candidates;
  }

  const objectSection = section as Record<string, unknown>;
  for (const key of HEURISTICS_COLLECTION_KEYS) {
    pushArray(objectSection[key]);
  }

  const keyedMatches: string[] = [];

  for (const [key, value] of Object.entries(objectSection)) {
    if (HEURISTICS_METADATA_KEYS.has(key) || HEURISTICS_COLLECTION_KEYS.includes(key)) {
      continue;
    }

    if (!value) {
      continue;
    }

    if (Array.isArray(value)) {
      const before = candidates.length;
      pushArray(value, key);
      if (candidates.length > before) {
        keyedMatches.push(key);
      }
      continue;
    }

    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (looksLikeHeuristicRecord(record)) {
        candidates.push({ record, fallbackKey: key });
        keyedMatches.push(key);
        continue;
      }

      for (const nestedKey of HEURISTICS_COLLECTION_KEYS) {
        const nestedValue = record[nestedKey];
        if (!Array.isArray(nestedValue)) {
          continue;
        }
        const before = candidates.length;
        pushArray(nestedValue, key);
        if (candidates.length > before) {
          keyedMatches.push(`${key}.${nestedKey}`);
        }
      }
      continue;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      candidates.push({ record: { description: value }, fallbackKey: key });
      keyedMatches.push(key);
    }
  }

  if (keyedMatches.length) {
    logger.debug("[AnalysisNormalizer][Heuristics] Parsed keyed heuristics object", {
      keys: keyedMatches
    });
  }

  return candidates;
}

function normalizeHeuristicCandidate(candidate: HeuristicCandidate): AnalysisSectionItem | null {
  const { record, fallbackKey } = candidate;
  const rawTitle =
    asString(record["name"]) ?? asString(record["title"]) ?? asString(record["heuristic"]);
  const title = normalizeHeuristicTitle(rawTitle, fallbackKey);

  let description = asString(record["description"]) ?? asString(record["summary"]);

  const insights = asStringArray(record["insights"]);
  if (insights.length) {
    description = mergeDescription(description, insights.join("\n"));
  }

  const recommendations = asStringArray(record["recommendations"]).map((entry) => {
    const trimmed = entry.trim();
    if (!trimmed) {
      return "";
    }
    return /^Next\s*Steps:/i.test(trimmed) ? trimmed : `Next Steps: ${trimmed}`;
  });
  const recommendationBlock = recommendations.filter(Boolean).join("\n");
  if (recommendationBlock) {
    description = mergeDescription(description, recommendationBlock);
  }

  const score = parseScoreOrFallback(record);
  if (score !== undefined) {
    description = mergeDescription(description, `Score: ${score}/5`);
  }

  const severity = extractSeverity(record, score, ["severity", "intent"]);

  if (!title && !description) {
    return null;
  }

  return {
    title: title ?? "Insight",
    description,
    severity,
    score
  };
}

function looksLikeHeuristicRecord(record: Record<string, unknown>): boolean {
  return (
    typeof record["description"] === "string" ||
    typeof record["summary"] === "string" ||
    typeof record["name"] === "string" ||
    typeof record["title"] === "string" ||
    Array.isArray(record["insights"]) ||
    Array.isArray(record["recommendations"]) ||
    record["score"] !== undefined ||
    record["severity"] !== undefined ||
    record["intent"] !== undefined
  );
}

function normalizeHeuristicTitle(
  explicitTitle: string | undefined,
  fallbackKey?: string
): string | undefined {
  const candidate = explicitTitle ?? (fallbackKey ? formatKeyAsTitle(fallbackKey) : undefined);
  if (!candidate) {
    return undefined;
  }

  const canonical = matchCanonicalHeuristic(candidate);
  if (canonical) {
    return canonical;
  }

  return candidate;
}

function matchCanonicalHeuristic(candidate: string): string | undefined {
  const normalizedCandidate = normalizeHeuristicIdentifier(candidate);
  if (!normalizedCandidate) {
    return undefined;
  }

  const direct = CANONICAL_HEURISTIC_LOOKUP.get(normalizedCandidate);
  if (direct) {
    return direct;
  }

  if (normalizedCandidate.length < 4) {
    return undefined;
  }

  let bestMatch: { key: string; canonical: string } | null = null;

  for (const [key, canonical] of CANONICAL_HEURISTIC_LOOKUP.entries()) {
    if (key.includes(normalizedCandidate) || normalizedCandidate.includes(key)) {
      const overlap = Math.min(key.length, normalizedCandidate.length);
      if (!bestMatch || overlap > Math.min(bestMatch.key.length, normalizedCandidate.length)) {
        bestMatch = { key, canonical };
      }
    }
  }

  return bestMatch?.canonical;
}

function normalizeHeuristicIdentifier(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function mergeHeuristicItems(
  base: AnalysisSectionItem | undefined,
  incoming: AnalysisSectionItem
): AnalysisSectionItem {
  if (!base) {
    return incoming;
  }

  const description = mergeHeuristicDescriptions(base.description, incoming.description);

  return {
    title: incoming.title || base.title,
    description,
    severity: incoming.severity ?? base.severity,
    score: incoming.score ?? base.score
  };
}

function mergeHeuristicDescriptions(
  baseDescription: string | undefined,
  incomingDescription: string | undefined
): string | undefined {
  const parts: string[] = [];
  const seen = new Set<string>();

  for (const candidate of [baseDescription, incomingDescription]) {
    if (!candidate) {
      continue;
    }
    const trimmed = candidate.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    parts.push(candidate);
  }

  if (parts.length === 0) {
    return undefined;
  }

  return parts.join("\n");
}
