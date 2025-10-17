import { logger } from "@shared/utils/logger";
import { asString, asStringArray } from "./strings";
import { parseScoreOrFallback } from "./numbers";
import type { HeuristicScorecard, HeuristicScorecardEntry } from "./types";

const SCORECARD_BUCKETS: Array<{
  key: keyof HeuristicScorecard;
  aliases: string[];
  fallbackTitle: string;
}> = [
  { key: "strengths", aliases: ["strength", "pros", "advantages"], fallbackTitle: "Strength" },
  { key: "weaknesses", aliases: ["weakness", "cons", "gaps"], fallbackTitle: "Weakness" },
  { key: "opportunities", aliases: ["opportunity", "bets", "risks"], fallbackTitle: "Opportunity" }
];

export function normalizeHeuristicScorecard(value: unknown): HeuristicScorecard {
  const empty: HeuristicScorecard = {
    strengths: [],
    weaknesses: [],
    opportunities: []
  };

  if (!value || typeof value !== "object") {
    if (value != null) {
      logger.debug("[AnalysisNormalizer][Heuristics] Scorecard payload not an object", {
        payloadType: typeof value
      });
    }
    return empty;
  }

  const record = value as Record<string, unknown>;
  const result: HeuristicScorecard = {
    strengths: [],
    weaknesses: [],
    opportunities: []
  };

  for (const bucket of SCORECARD_BUCKETS) {
    const sources: unknown[] = [];
    if (record[bucket.key]) sources.push(record[bucket.key]);
    for (const alias of bucket.aliases) {
      if (record[alias]) sources.push(record[alias]);
    }
    const normalized = normalizeBucketEntries(sources, bucket.fallbackTitle);
    if (normalized.length > 0) {
      result[bucket.key] = normalized;
    }
  }

  return result;
}

function normalizeBucketEntries(sources: unknown[], fallbackTitle: string): HeuristicScorecardEntry[] {
  const entries: HeuristicScorecardEntry[] = [];

  for (const source of sources) {
    if (!source) continue;

    if (Array.isArray(source)) {
      for (const item of source) {
        const normalized = normalizeEntry(item, fallbackTitle);
        if (normalized) entries.push(normalized);
      }
      continue;
    }

    const normalized = normalizeEntry(source, fallbackTitle);
    if (normalized) entries.push(normalized);
  }

  return dedupeEntries(entries);
}

function normalizeEntry(candidate: unknown, fallbackTitle: string): HeuristicScorecardEntry | null {
  if (!candidate) {
    return null;
  }

  if (typeof candidate === "string") {
    const text = candidate.trim();
    if (!text) {
      return null;
    }
    return {
      name: fallbackTitle,
      reason: text
    };
  }

  if (typeof candidate !== "object") {
    return null;
  }

  const record = candidate as Record<string, unknown>;
  const name =
    asString(record["name"]) ??
    asString(record["title"]) ??
    asString(record["heuristic"]) ??
    asString(record["id"]) ??
    fallbackTitle;
  const reason =
    asString(record["reason"]) ??
    asString(record["summary"]) ??
    asString(record["description"]) ??
    extractFirstString(record["notes"]);
  const score = parseScoreOrFallback(record);

  if (!name && !reason) {
    return null;
  }

  return {
    name: name || fallbackTitle,
    reason: reason || undefined,
    score: score
  };
}

function extractFirstString(value: unknown): string | undefined {
  const items = asStringArray(value);
  return items.length > 0 ? items[0] : undefined;
}

function dedupeEntries(entries: HeuristicScorecardEntry[]): HeuristicScorecardEntry[] {
  const seen = new Set<string>();
  const results: HeuristicScorecardEntry[] = [];

  for (const entry of entries) {
    const signature = `${entry.name?.toLowerCase() ?? ""}|${entry.reason?.toLowerCase() ?? ""}|${
      entry.score ?? ""
    }`;
    if (seen.has(signature)) {
      continue;
    }
    seen.add(signature);
    results.push(entry);
  }

  return results;
}
