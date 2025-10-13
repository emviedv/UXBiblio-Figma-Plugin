import { logger } from "@shared/utils/logger";
import { stripObservationTokens } from "./strings";

export interface AnalysisSectionItem {
  title: string;
  description?: string;
  severity?: string;
  score?: number;
}

export interface AnalysisSource {
  title: string;
  url?: string;
  domainTier?: string;
  publishedYear?: number;
  usedFor?: string;
}

export interface AccessibilityExtras {
  contrastScore?: number;
  summary?: string;
  issues: string[];
  recommendations: string[];
  sources: AnalysisSource[];
}

export interface CopywritingContent {
  heading?: string;
  summary?: string;
  guidance: string[];
  sources: AnalysisSource[];
}

export interface StructuredAnalysis {
  summary?: string;
  receipts: AnalysisSource[];
  copywriting: CopywritingContent;
  accessibilityExtras: AccessibilityExtras;
  heuristics: AnalysisSectionItem[];
  accessibility: AnalysisSectionItem[];
  psychology: AnalysisSectionItem[];
  impact: AnalysisSectionItem[];
  recommendations: string[];
  // Classification & meta
  contentType?: string;
  flows: string[];
  industries: string[];
  uiElements: string[];
  psychologyTags: string[];
  suggestedTitle?: string;
  suggestedTags: string[];
  suggestedCollection?: string;
  confidence?: { level?: string; rationale?: string };
  obsCount?: number;
}

export function extractAnalysisData(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;

  if (
    Array.isArray(record["heuristics"]) ||
    Array.isArray(record["accessibility"]) ||
    Array.isArray(record["psychology"]) ||
    Array.isArray(record["impact"]) ||
    Array.isArray(record["recommendations"])
  ) {
    return value;
  }

  const nested = record["analysis"];
  if (nested && typeof nested === "object") {
    return nested;
  }

  return value;
}

export function normalizeAnalysis(data: unknown): StructuredAnalysis {
  if (!data || typeof data !== "object") {
    return {
      summary: undefined,
      receipts: [],
      copywriting: { heading: undefined, summary: undefined, guidance: [], sources: [] },
      accessibilityExtras: {
        contrastScore: undefined,
        summary: undefined,
        issues: [],
        recommendations: [],
        sources: []
      },
      heuristics: [],
      accessibility: [],
      psychology: [],
      impact: [],
      recommendations: [],
      flows: [],
      industries: [],
      uiElements: [],
      psychologyTags: [],
      suggestedTags: []
    };
  }

  const record = data as Record<string, unknown>;
  const evidenceCount = countObsTokensDeep(record);
  const accessibilityNormalized = normalizeAccessibility(record["accessibility"]);
  const heuristicsItems = ensureAllHeuristics(normalizeHeuristics(record["heuristics"]));
  const psychologyItems = normalizePsychology(record["psychology"]);
  const impactItems = normalizeImpact(record["impact"]);

  const baseRecommendations = normalizeRecommendations(record["recommendations"]);
  const recapFromPsych = extractNextStepsFromItems(psychologyItems);
  const recapFromImpact = extractNextStepsFromItems(impactItems);
  const recapFromHeuristics = extractNextStepsFromItems(heuristicsItems);
  const recapFromA11yExtras = accessibilityNormalized.extras.recommendations ?? [];
  const combinedRecommendations = mergeUniqueStrings([
    baseRecommendations,
    recapFromPsych,
    recapFromImpact,
    recapFromHeuristics,
    recapFromA11yExtras
  ]);

  const baseReceipts = normalizeReceipts(record["receipts"]);
  const mergedSectionSources = gatherSectionSources(record);
  const mergedReceipts = dedupeSources([...baseReceipts, ...mergedSectionSources]);

  const confidence = normalizeConfidence(record["confidence"]);

  return {
    summary: asString(record["summary"]),
    receipts: mergedReceipts,
    copywriting: normalizeCopywriting(record["uxCopywriting"] ?? record["copywriting"]),
    accessibilityExtras: accessibilityNormalized.extras,
    heuristics: heuristicsItems,
    accessibility: accessibilityNormalized.items,
    psychology: psychologyItems,
    impact: impactItems,
    recommendations: combinedRecommendations,
    // Classification/meta
    contentType: asString(record["contentType"]),
    flows: asStringArray(record["flows"]),
    industries: asStringArray(record["industries"]),
    uiElements: asStringArray(record["uiElements"]),
    psychologyTags: asStringArray(record["psychologyTags"]),
    suggestedTitle: asString(record["suggestedTitle"]),
    suggestedTags: asStringArray(record["suggestedTags"]),
    suggestedCollection: asString(record["suggestedCollection"]),
    confidence,
    obsCount: evidenceCount || undefined
  };
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
        if (t) results.push(t);
      }
    }
  }
  return results;
}

function normalizeConfidence(value: unknown): { level?: string; rationale?: string } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const rec = value as Record<string, unknown>;
  const level = asString(rec["level"]);
  const rationale = asString(rec["rationale"]);
  if (!level && !rationale) return undefined;
  return { level, rationale };
}

function gatherSectionSources(record: Record<string, unknown>): AnalysisSource[] {
  const results: AnalysisSource[] = [];

  // Heuristics sources
  const heuristicsRaw = Array.isArray(record["heuristics"]) ? record["heuristics"] : [];
  for (const h of heuristicsRaw) {
    if (!h || typeof h !== "object") continue;
    const entry = h as Record<string, unknown>;
    const sources = normalizeReceipts(entry["sources"]);
    if (sources.length) results.push(...sources);
  }

  // Impact areas sources
  const impactObj = record["impact"];
  if (impactObj && typeof impactObj === "object") {
    const areas = Array.isArray((impactObj as any).areas) ? (impactObj as any).areas : [];
    for (const area of areas) {
      if (!area || typeof area !== "object") continue;
      const sources = normalizeReceipts((area as Record<string, unknown>)["sources"]);
      if (sources.length) results.push(...sources);
    }
  }

  // Psychology sources
  const psychologyObj = record["psychology"];
  if (psychologyObj && typeof psychologyObj === "object") {
    const pers = Array.isArray((psychologyObj as any).persuasionTechniques)
      ? (psychologyObj as any).persuasionTechniques
      : [];
    for (const p of pers) {
      if (!p || typeof p !== "object") continue;
      const sources = normalizeReceipts((p as Record<string, unknown>)["sources"]);
      if (sources.length) results.push(...sources);
    }
    const triggers = Array.isArray((psychologyObj as any).behavioralTriggers)
      ? (psychologyObj as any).behavioralTriggers
      : [];
    for (const t of triggers) {
      if (!t || typeof t !== "object") continue;
      const sources = normalizeReceipts((t as Record<string, unknown>)["sources"]);
      if (sources.length) results.push(...sources);
    }
  }

  return results;
}

function dedupeSources(sources: AnalysisSource[]): AnalysisSource[] {
  const seen = new Set<string>();
  const out: AnalysisSource[] = [];
  for (const s of sources) {
    const key = `${(s.title || "").toLowerCase()}|${(s.url || "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function countObsTokensDeep(value: unknown): number {
  let count = 0;
  const visit = (v: unknown) => {
    if (typeof v === "string") {
      const matches = v.match(/\bOBS-\d+\b/gi);
      if (matches) count += matches.length;
      return;
    }
    if (Array.isArray(v)) {
      for (const item of v) visit(item);
      return;
    }
    if (v && typeof v === "object") {
      for (const k of Object.keys(v as Record<string, unknown>)) {
        visit((v as Record<string, unknown>)[k]);
      }
    }
  };
  visit(value);
  return count;
}

export function normalizeReceipts(value: unknown): AnalysisSource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const entry = item as Record<string, unknown>;
      const rawTitle = asString(entry["title"]);
      const url = asString(entry["url"]);
      const domainTier = asString(entry["domainTier"]);
      const usedFor = asString(entry["usedFor"]);
      const publishedYear = normalizePublishedYear(entry["publishedYear"]);

      if (!rawTitle && !url) {
        return null;
      }

      return {
        title: rawTitle ?? url ?? "Source",
        url,
        domainTier,
        usedFor,
        publishedYear
      };
    })
    .filter(Boolean) as AnalysisSource[];
}

export function normalizeCopywriting(value: unknown): CopywritingContent {
  const base: CopywritingContent = {
    heading: undefined,
    summary: undefined,
    guidance: [],
    sources: []
  };

  if (!value) {
    return base;
  }

  if (typeof value === "string") {
    return {
      ...base,
      summary: value
    };
  }

  if (Array.isArray(value)) {
    return {
      ...base,
      guidance: asStringArray(value)
    };
  }

  if (typeof value !== "object") {
    return base;
  }

  const record = value as Record<string, unknown>;
  const heading =
    asString(record["heading"]) ?? asString(record["title"]) ?? asString(record["label"]);
  const summary =
    asString(record["summary"]) ??
    asString(record["description"]) ??
    asString(record["copy"]);
  const guidance = mergeUniqueStrings([
    asStringArray(record["guidance"]),
    asStringArray(record["notes"]),
    asStringArray(record["recommendations"]),
    asStringArray(record["examples"]),
    asStringArray(record["bullets"]) 
  ]);
  const sources = normalizeReceipts(record["sources"]);

  return {
    heading,
    summary,
    guidance,
    sources
  };
}

export function normalizeSection(section: unknown): AnalysisSectionItem[] {
  if (!Array.isArray(section)) {
    return [];
  }

  return section
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const entry = item as Record<string, unknown>;
      const title = asString(entry["title"]) ?? asString(entry["name"]);
      let description = asString(entry["description"]) ?? asString(entry["summary"]);

      const additionalDetails = asStringArray(entry["insights"]);
      if (additionalDetails.length) {
        description = mergeDescription(description, additionalDetails.join("\n"));
      }

      const severity =
        asString(entry["severity"]) ?? asString(entry["intent"]) ?? asString(entry["status"]);

      if (!title && !description) {
        return null;
      }

      return {
        title: title ?? "Insight",
        description,
        severity
      } as AnalysisSectionItem;
    })
    .filter(Boolean) as AnalysisSectionItem[];
}

export function normalizeRecommendations(recommendations: unknown): string[] {
  if (Array.isArray(recommendations)) {
    return recommendations.filter((item): item is string => typeof item === "string");
  }

  if (!recommendations || typeof recommendations !== "object") {
    return [];
  }

  const record = recommendations as Record<string, unknown>;
  const priority = asString(record["priority"]);
  const immediate = asStringArray(record["immediate"]).map(
    (text) => `[Immediate] ${text}`
  );
  const longTerm = asStringArray(record["longTerm"]).map((text) => `[Long-term] ${text}`);

  const combined = [...immediate, ...longTerm];

  if (priority) {
    combined.unshift(`Overall priority: ${priority}`);
  }

  return combined;
}

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

export function severityFromScore(score: number): string {
  if (score <= 2) {
    return "high";
  }
  if (score === 3) {
    return "medium";
  }
  return "low";
}

// Canonical Nielsen heuristics — always surface in UI
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

      // Some upstream payloads may nest the actual entries under a child collection.
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

  const score = normalizeFivePointScore(record["score"] ?? record["scoreValue"] ?? record["rating"]);
  if (score !== undefined) {
    description = mergeDescription(description, `Score: ${score}/5`);
  }

  const severity =
    asString(record["severity"]) ??
    asString(record["intent"]) ??
    (score !== undefined ? severityFromScore(score) : undefined);

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

const CANONICAL_HEURISTIC_LOOKUP = new Map(
  CANONICAL_HEURISTICS.map((name) => [normalizeHeuristicIdentifier(name), name])
);

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

function formatKeyAsTitle(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-\s]+/g, " ")
    .trim();

  if (!spaced) {
    return key;
  }

  return spaced
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ")
    .trim();
}

function ensureAllHeuristics(items: AnalysisSectionItem[]): AnalysisSectionItem[] {
  const canonicalMap = new Map<string, AnalysisSectionItem>();
  const nonCanonical: AnalysisSectionItem[] = [];

  for (const item of items) {
    const canonicalTitle = matchCanonicalHeuristic(item.title) ?? item.title;
    if (CANONICAL_HEURISTICS.includes(canonicalTitle)) {
      const existing = canonicalMap.get(canonicalTitle);
      canonicalMap.set(
        canonicalTitle,
        mergeHeuristicItems(
          existing,
          { ...item, title: canonicalTitle }
        )
      );
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

function mergeHeuristicItems(
  base: AnalysisSectionItem | undefined,
  incoming: AnalysisSectionItem
): AnalysisSectionItem {
  if (!base) {
    return incoming;
  }

  const combinedDescription = mergeHeuristicDescriptions(base.description, incoming.description);
  const score = incoming.score ?? base.score;

  return {
    title: incoming.title || base.title,
    description: combinedDescription,
    severity: incoming.severity ?? base.severity,
    score
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

export function normalizeAccessibility(
  section: unknown
): { items: AnalysisSectionItem[]; extras: AccessibilityExtras } {
  const extras: AccessibilityExtras = {
    contrastScore: undefined,
    summary: undefined,
    issues: [],
    recommendations: [],
    sources: []
  };

  if (Array.isArray(section)) {
    return {
      items: normalizeSection(section),
      extras
    };
  }

  if (!section || typeof section !== "object") {
    return {
      items: [],
      extras
    };
  }

  const record = section as Record<string, unknown>;
  const items: AnalysisSectionItem[] = [];
  extras.contrastScore = normalizeContrastScore(record["contrastScore"]);
  extras.summary = asString(record["summary"]);
  extras.issues = asStringArray(record["issues"]);
  extras.recommendations = asStringArray(record["recommendations"]);
  extras.sources = normalizeReceipts(record["sources"]);

  const categories = Array.isArray(record["categories"]) ? record["categories"] : [];

  for (const category of categories) {
    if (!category || typeof category !== "object") {
      continue;
    }

    const entry = category as Record<string, unknown>;
    const title = asString(entry["title"]) ?? asString(entry["id"]) ?? "Accessibility";
    const severity = asString(entry["status"]);

    const parts: string[] = [];
    pushIf(parts, asString(entry["summary"]));
    pushList(parts, "Checks", asStringArray(entry["checks"]), "; ");
    pushList(parts, "Issues", asStringArray(entry["issues"]), "; ");
    pushList(parts, "Recommendations", asStringArray(entry["recommendations"]), "; ");

    items.push({ title, description: partsToDescription(parts), severity });
  }

  return { items, extras };
}

export function normalizeImpact(section: unknown): AnalysisSectionItem[] {
  if (Array.isArray(section)) {
    return normalizeSection(section);
  }

  if (!section || typeof section !== "object") {
    return [];
  }

  const record = section as Record<string, unknown>;
  const items: AnalysisSectionItem[] = [];

  const summary = asString(record["summary"]);
  if (summary) {
    items.push({ title: "Overview", description: summary });
  }

  const areas = Array.isArray(record["areas"]) ? record["areas"] : [];

  for (const area of areas) {
    if (!area || typeof area !== "object") {
      continue;
    }

    const entry = area as Record<string, unknown>;
    const title = asString(entry["category"]) ?? "Impact";
    const severity = asString(entry["severity"]);

    const parts: string[] = [];
    pushIf(parts, asString(entry["summary"]));
    pushList(parts, "Next Steps", asStringArray(entry["recommendations"]), "; ");

    const description = partsToDescription(parts);

    if (!title && !description) {
      continue;
    }

    items.push({
      title,
      description,
      severity
    });
  }

  return items;
}

interface PsychologyCandidate {
  record: Record<string, unknown>;
  fallbackKey?: string;
}

const PSYCHOLOGY_METADATA_KEYS = new Set([
  "summary",
  "overview",
  "notes",
  "sources",
  "meta",
  "metadata",
  "tags"
]);

const PSYCHOLOGY_COLLECTION_KEYS = ["items", "entries", "list", "values"];

function collectPsychologyCandidates(
  value: unknown,
  defaultTitle: string,
  sectionKey: string
): PsychologyCandidate[] {
  const candidates: PsychologyCandidate[] = [];
  const keyedMatches: string[] = [];

  const pushArray = (input: unknown, fallbackKey?: string) => {
    if (!Array.isArray(input)) {
      return;
    }
    for (const item of input) {
      if (!item) {
        continue;
      }
      if (typeof item === "object") {
        candidates.push({ record: item as Record<string, unknown>, fallbackKey });
        continue;
      }
      if (typeof item === "string") {
        const trimmed = item.trim();
        if (!trimmed) {
          continue;
        }
        const record: Record<string, unknown> = { summary: trimmed };
        if (!fallbackKey) {
          record["title"] = defaultTitle;
        }
        candidates.push({ record, fallbackKey });
      }
    }
  };

  if (!value) {
    return candidates;
  }

  if (Array.isArray(value)) {
    pushArray(value);
    return candidates;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      candidates.push({ record: { summary: trimmed, title: defaultTitle } });
    }
    return candidates;
  }

  if (typeof value !== "object") {
    return candidates;
  }

  const objectValue = value as Record<string, unknown>;
  for (const key of PSYCHOLOGY_COLLECTION_KEYS) {
    pushArray(objectValue[key]);
  }

  for (const [key, entry] of Object.entries(objectValue)) {
    if (PSYCHOLOGY_METADATA_KEYS.has(key) || PSYCHOLOGY_COLLECTION_KEYS.includes(key)) {
      continue;
    }

    if (!entry) {
      continue;
    }

    if (Array.isArray(entry)) {
      const before = candidates.length;
      pushArray(entry, key);
      if (candidates.length > before) {
        keyedMatches.push(`${sectionKey}.${key}`);
      }
      continue;
    }

    if (typeof entry === "object") {
      candidates.push({ record: entry as Record<string, unknown>, fallbackKey: key });
      keyedMatches.push(`${sectionKey}.${key}`);
      for (const nestedKey of PSYCHOLOGY_COLLECTION_KEYS) {
        const nested = (entry as Record<string, unknown>)[nestedKey];
        if (!Array.isArray(nested)) {
          continue;
        }
        const before = candidates.length;
        pushArray(nested, key);
        if (candidates.length > before) {
          keyedMatches.push(`${sectionKey}.${key}.${nestedKey}`);
        }
      }
      continue;
    }

    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (trimmed) {
        candidates.push({ record: { summary: trimmed }, fallbackKey: key });
        keyedMatches.push(`${sectionKey}.${key}`);
      }
    }
  }

  if (keyedMatches.length) {
    logger.debug("[AnalysisNormalizer][Psychology] Parsed keyed object", {
      section: sectionKey,
      keys: keyedMatches
    });
  }

  return candidates;
}

export function normalizePsychology(section: unknown): AnalysisSectionItem[] {
  if (Array.isArray(section)) {
    return normalizeSection(section);
  }

  if (!section || typeof section !== "object") {
    return [];
  }

  const record = section as Record<string, unknown>;
  const items: AnalysisSectionItem[] = [];

  const persuasionCandidates = collectPsychologyCandidates(
    record["persuasionTechniques"],
    "Persuasion Technique",
    "persuasionTechniques"
  );
  for (const { record: entry, fallbackKey } of persuasionCandidates) {
    const title =
      asString(entry["title"]) ?? (fallbackKey ? formatKeyAsTitle(fallbackKey) : "Persuasion Technique");
    const severity = asString(entry["intent"]);

    const parts: string[] = [];
    pushIf(parts, asString(entry["summary"]));
    // Omit metadata like Stage/Guardrail from rendered description
    pushList(parts, "Next Steps", asStringArray(entry["recommendations"]), "; ");
    pushList(parts, "Signals", asStringArray(entry["signals"]), ", ");

    const description = partsToDescription(parts);
    if (!title && !description) {
      continue;
    }

    items.push({ title: title ?? "Persuasion Technique", description, severity });
  }

  const triggerCandidates = collectPsychologyCandidates(
    record["behavioralTriggers"],
    "Behavioral Trigger",
    "behavioralTriggers"
  );
  for (const { record: entry, fallbackKey } of triggerCandidates) {
    const title =
      asString(entry["title"]) ?? (fallbackKey ? formatKeyAsTitle(fallbackKey) : "Behavioral Trigger");
    const severity = asString(entry["intent"]);

    const parts: string[] = [];
    pushIf(parts, asString(entry["summary"]));
    // Omit metadata like Stage/Guardrail from rendered description
    pushList(parts, "Next Steps", asStringArray(entry["recommendations"]), "; ");
    pushList(parts, "Signals", asStringArray(entry["signals"]), ", ");

    const description = partsToDescription(parts);
    if (!title && !description) {
      continue;
    }

    items.push({ title: title ?? "Behavioral Trigger", description, severity });
  }

  if (!items.length) {
    return normalizeSection(section);
  }

  return ensureMinimumPsychologyExamples(items, 3);
}

export function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const sanitized = stripObservationTokens(trimmed);
  return sanitized.length ? sanitized : undefined;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const results: string[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (!trimmed) {
        continue;
      }

      const sanitized = stripObservationTokens(trimmed);
      if (sanitized) {
        results.push(sanitized);
      }
    }
  }
  return results;
}

export function mergeUniqueStrings(groups: string[][]): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const group of groups) {
    for (const item of group) {
      if (!seen.has(item)) {
        seen.add(item);
        results.push(item);
      }
    }
  }

  return results;
}

export function normalizePublishedYear(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

export function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

export function normalizeContrastScore(value: unknown): number | undefined {
  const numberValue = asNumber(value);

  if (numberValue === undefined) {
    return undefined;
  }

  const rounded = Math.round(numberValue);
  if (!Number.isFinite(rounded)) {
    return undefined;
  }

  return Math.min(5, Math.max(1, rounded));
}

function normalizeFivePointScore(value: unknown): number | undefined {
  const numberValue = asNumber(value);
  if (numberValue === undefined) {
    return undefined;
  }
  const clamped = Math.min(5, Math.max(1, numberValue));
  return Math.round(clamped * 10) / 10;
}

export function mergeDescription(
  base: string | undefined,
  addition: string | undefined
): string | undefined {
  if (!addition) {
    return base;
  }
  if (!base) {
    return addition;
  }
  return `${base}\n${addition}`;
}

function pushIf(parts: string[], value: string | undefined): void {
  if (value) {
    parts.push(value);
  }
}

function pushList(parts: string[], label: string, values: string[], joiner: string): void {
  if (values.length) {
    parts.push(`${label}: ${values.join(joiner)}`);
  }
}

function partsToDescription(parts: string[]): string | undefined {
  const text = parts.join("\n");
  return text || undefined;
}

function ensureMinimumPsychologyExamples(
  items: AnalysisSectionItem[],
  minCount: number
): AnalysisSectionItem[] {
  if (items.length === 0) return items;
  const defaults = ["Persuasion Technique", "Behavioral Trigger", "Psychology Insight"];
  const out = items.slice();
  while (out.length < minCount) {
    const title = defaults[out.length % defaults.length];
    out.push({ title });
  }
  return out;
}
