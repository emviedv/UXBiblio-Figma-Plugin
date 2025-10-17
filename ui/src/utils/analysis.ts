import {
  asString,
  asStringArray,
  collectRecommendations,
  dedupeSources,
  ensureAllHeuristics,
  gatherSectionSources,
  mergeUniqueStrings,
  normalizeAccessibility,
  normalizeHeuristicScorecard,
  normalizeHeuristics,
  normalizeImpact,
  normalizeReceipts,
  normalizeRecommendations,
  normalizePsychology
} from "./analysis/index";
import type {
  AnalysisSource,
  CopywritingContent,
  CopywritingSectionBlock,
  CopywritingSectionEntry,
  StructuredAnalysis
} from "./analysis/index";
import { logger } from "@shared/utils/logger";

export * from "./analysis/index";

export function extractAnalysisData(value: unknown): unknown {
  const record = asRecord(value);
  if (!record) {
    return value;
  }

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
  const record = asRecord(data);
  if (!record) {
    return createEmptyAnalysis();
  }

  const { extras: accessibilityExtras, items: accessibilityItems } = normalizeAccessibility(
    record["accessibility"],
    record["accessibilityCheck"]
  );
  const heuristicsItems = ensureAllHeuristics(normalizeHeuristics(record["heuristics"]));
  const psychologyItems = normalizePsychology(record["psychology"]);
  const impactItems = normalizeImpact(record["impact"]);
  const heuristicScorecard = normalizeHeuristicScorecard(record["heuristicScorecard"]);

  const scopeNote = asString(record["scopeNote"]);
  const combinedSummary = mergeSummaryContent(scopeNote, asString(record["summary"]));
  if (scopeNote) {
    logger.debug("[AnalysisNormalizer] Scope note merged", {
      scopeNoteLength: scopeNote.length,
      summaryLength: combinedSummary?.length ?? 0,
      hadStandaloneSummary: Boolean(record["summary"])
    });
  }

  const combinedRecommendations = collectRecommendations({
    base: normalizeRecommendations(record["recommendations"]),
    psychology: psychologyItems,
    impact: impactItems,
    heuristics: heuristicsItems,
    accessibilityExtras
  });
  // Emit recommendations parity diagnostics to understand any metadata loss vs. raw payload
  try {
    debugRecommendationsDelta(record["recommendations"], combinedRecommendations);
  } catch (error) {
    logger.warn("[AnalysisNormalizer] Failed to emit recommendations delta diagnostics", { error });
  }
  const uxSignals = normalizeUxSignals(record["uxSignals"]);

  const copywritingPayload = record["uxCopywriting"] ?? record["copywriting"];
  if (!copywritingPayload) {
    logger.warn("[AnalysisNormalizer] Copywriting payload missing", {
      hasUxCopywriting: Object.prototype.hasOwnProperty.call(record, "uxCopywriting"),
      hasCopywriting: Object.prototype.hasOwnProperty.call(record, "copywriting"),
      keys: Object.keys(record)
    });
  }
  const confidence = normalizeConfidence(record["confidence"]);
  const metadata = normalizeAnalysisMetadata(record);
  const obsCount = countObsTokensDeep(record) || undefined;
  const promptVersion = asString(record["promptVersion"]);
  if (!promptVersion) {
    logger.debug("[AnalysisNormalizer] Missing promptVersion in analysis payload", {
      hasSummary: Boolean(record["summary"]),
      keys: Object.keys(record)
    });
  }

  const normalizedCopywriting = normalizeCopywriting(copywritingPayload);
  if (
    copywritingPayload &&
    !normalizedCopywriting.summary &&
    !normalizedCopywriting.heading &&
    normalizedCopywriting.guidance.length === 0 &&
    normalizedCopywriting.sources.length === 0
  ) {
    logger.warn("[AnalysisNormalizer] Copywriting payload normalized empty", {
      payloadType: typeof copywritingPayload === "object" ? "object" : typeof copywritingPayload,
      keys:
        copywritingPayload && typeof copywritingPayload === "object"
          ? Object.keys(copywritingPayload as Record<string, unknown>)
          : null
    });
  }

  const receipts = normalizePipelineReceipts(record);
  emitSourceDiagnostics(record, receipts);

  const structured: StructuredAnalysis = {
    ...createEmptyAnalysis(),
    summary: combinedSummary,
    scopeNote,
    receipts,
    copywriting: normalizedCopywriting,
    accessibilityExtras,
    heuristicScorecard,
    heuristics: heuristicsItems,
    accessibility: accessibilityItems,
    psychology: psychologyItems,
    impact: impactItems,
    recommendations: combinedRecommendations,
    ...metadata,
    confidence,
    obsCount,
    promptVersion: promptVersion ?? undefined,
    uxSignals
  };

  // Emit one-shot normalization diagnostics to aid Chrome parity comparisons
  try {
    debugNormalizationDelta(record, structured);
  } catch (error) {
    logger.warn("[AnalysisNormalizer] Failed to emit normalization diagnostics", { error });
  }

  return structured;
}

function normalizeUxSignals(value: unknown): string[] {
  const sources: string[][] = [];

  if (Array.isArray(value)) {
    sources.push(asStringArray(value));
  } else {
    const single = asString(value);
    if (single) {
      sources.push([single]);
    }
  }

  const deduped = mergeUniqueStrings(sources);
  return deduped.slice(0, 6);
}

function normalizeConfidence(value: unknown): { level?: string; rationale?: string } | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const level = asString(record["level"]);
  const rationale = asString(record["rationale"]);
  if (!level && !rationale) return undefined;
  return { level, rationale };
}

function countObsTokensDeep(value: unknown): number {
  let count = 0;
  const stack: unknown[] = [value];
  while (stack.length) {
    const item = stack.pop();
    if (typeof item === "string") {
      OBS_TOKEN_PATTERN.lastIndex = 0;
      const matches = item.match(OBS_TOKEN_PATTERN);
      if (matches) count += matches.length;
      continue;
    }
    if (Array.isArray(item)) {
      stack.push(...item);
      continue;
    }
    const recordItem = asRecord(item);
    if (recordItem) {
      stack.push(...Object.values(recordItem));
    }
  }
  return count;
}

function createEmptyAnalysis(): StructuredAnalysis {
  return {
    summary: undefined,
    scopeNote: undefined,
    receipts: [],
    copywriting: { heading: undefined, summary: undefined, guidance: [], sources: [], sections: [] },
    accessibilityExtras: {
      contrastScore: undefined,
      contrastStatus: undefined,
      keyRecommendation: undefined,
      summary: undefined,
      issues: [],
      recommendations: [],
      sources: [],
      guardrails: []
    },
    heuristicScorecard: { strengths: [], weaknesses: [], opportunities: [] },
    heuristics: [],
    accessibility: [],
    psychology: [],
    impact: [],
    recommendations: [],
    flows: [],
    industries: [],
    uiElements: [],
    psychologyTags: [],
    suggestedTags: [],
    uxSignals: [],
    promptVersion: undefined
  };
}

type AnalysisMetadataFields = Pick<
  StructuredAnalysis,
  | "contentType"
  | "flows"
  | "industries"
  | "uiElements"
  | "psychologyTags"
  | "suggestedTitle"
  | "suggestedTags"
  | "suggestedCollection"
>;

function normalizeAnalysisMetadata(record: Record<string, unknown>): AnalysisMetadataFields {
  return {
    contentType: asString(record["contentType"]),
    flows: asStringArray(record["flows"]),
    industries: asStringArray(record["industries"]),
    uiElements: asStringArray(record["uiElements"]),
    psychologyTags: asStringArray(record["psychologyTags"]),
    suggestedTitle: asString(record["suggestedTitle"]),
    suggestedTags: asStringArray(record["suggestedTags"]),
    suggestedCollection: asString(record["suggestedCollection"])
  };
}

function normalizePipelineReceipts(record: Record<string, unknown>): AnalysisSource[] {
  const baseReceipts = normalizeReceipts(record["receipts"]);
  const mergedSectionSources = gatherSectionSources(record);
  return dedupeSources([...baseReceipts, ...mergedSectionSources]);
}

function emitSourceDiagnostics(
  record: Record<string, unknown>,
  receipts: AnalysisSource[]
): void {
  if (!receipts.length || !logger.isEnabled()) {
    return;
  }

  const total = receipts.length;
  const rawReceiptsCount = Array.isArray(record["receipts"])
    ? (record["receipts"] as unknown[]).length
    : undefined;
  const domainCounts = new Map<string, number>();
  const duplicateUrls: string[] = [];
  const invalidUrls: string[] = [];
  const missingUrlIndexes: number[] = [];
  const urlSeen = new Set<string>();

  receipts.forEach((source, index) => {
    const rawUrl = source.url?.trim();
    if (!rawUrl) {
      missingUrlIndexes.push(index);
      return;
    }

    const normalizedUrl = rawUrl.toLowerCase();
    if (urlSeen.has(normalizedUrl)) {
      duplicateUrls.push(rawUrl);
    } else {
      urlSeen.add(normalizedUrl);
    }

    try {
      const parsed = new URL(rawUrl);
      const domain = parsed.hostname.toLowerCase();
      domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
    } catch {
      invalidUrls.push(rawUrl);
    }
  });

  const domainDistribution = Array.from(domainCounts.entries())
    .map(([domain, count]) => ({
      domain,
      count,
      share: Number((count / total).toFixed(3))
    }))
    .sort((a, b) => b.count - a.count);

  const topDomain = domainDistribution[0];
  const exceedsDomainShareThreshold = Boolean(topDomain && topDomain.count / total > 0.5);
  const hasDomainRecords = domainDistribution.length > 0;

  logger.debug("[AnalysisNormalizer][Sources] Receipts diagnostics", {
    total,
    rawReceiptsCount,
    uniqueDomains: domainDistribution.length,
    domainDistribution,
    missingUrlCount: missingUrlIndexes.length || undefined,
    invalidUrlCount: invalidUrls.length || undefined,
    duplicateUrls: duplicateUrls.length ? duplicateUrls : undefined
  });

  if (missingUrlIndexes.length || invalidUrls.length || exceedsDomainShareThreshold) {
    logger.warn("[AnalysisNormalizer][Sources] Validation flags raised", {
      exceedsDomainShareThreshold: exceedsDomainShareThreshold || undefined,
      topDomain: topDomain ?? undefined,
      hasDomainRecords,
      missingUrlIndexes: missingUrlIndexes.length ? missingUrlIndexes : undefined,
      invalidUrls: invalidUrls.length ? invalidUrls : undefined,
      duplicateUrls: duplicateUrls.length ? duplicateUrls : undefined
    });
  }
}

export function normalizeCopywriting(value: unknown): CopywritingContent {
  const base = createCopywritingBase();

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

  const record = asRecord(value);
  if (!record) {
    return base;
  }

  const rawKeys = Object.keys(record);
  const rawSections = record["sections"];
  if (rawKeys.length > 0) {
    const recognizedKeys = rawKeys.filter((key) => KNOWN_COPYWRITING_KEYS.has(key));
    const unknownKeys = rawKeys.filter((key) => !KNOWN_COPYWRITING_KEYS.has(key));
    logger.debug("[AnalysisNormalizer][Copywriting] Raw payload snapshot", {
      keys: rawKeys,
      recognizedKeys,
      unknownKeys: unknownKeys.length ? unknownKeys : undefined,
      hasSections: Array.isArray(rawSections),
      sectionCount: Array.isArray(rawSections) ? rawSections.length : undefined
    });
  }

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
  const normalizedSections = normalizeCopywritingSections(record["sections"]);

  return {
    heading,
    summary,
    guidance,
    sources,
    sections: normalizedSections
  };
}

const KNOWN_COPYWRITING_KEYS = new Set([
  "heading",
  "summary",
  "guidance",
  "sources",
  "notes",
  "recommendations",
  "examples",
  "bullets",
  "description",
  "copy",
  "title",
  "label",
  "sections"
]);

function normalizeCopywritingSections(value: unknown): CopywritingSectionEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const sections: CopywritingSectionEntry[] = [];

  value.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") {
      return;
    }

    const record = entry as Record<string, unknown>;
    const blocks = normalizeCopywritingSectionBlocks(record["blocks"]);
    if (blocks.length === 0) {
      const fallbackText = asString(record["text"]) ?? asString(record["summary"]);
      const fallbackItems = asStringArray(record["items"]);
      if (fallbackText) {
        blocks.push({ type: "text", text: fallbackText });
      }
      if (fallbackItems.length > 0) {
        blocks.push({ type: "list", items: fallbackItems });
      }
    }

    if (blocks.length === 0) {
      return;
    }

    const id = asString(record["id"]) ?? `section-${index + 1}`;
    const title = asString(record["title"]) ?? undefined;
    sections.push({ id, title, blocks });
  });

  return sections;
}

function normalizeCopywritingSectionBlocks(value: unknown): CopywritingSectionBlock[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const blocks: CopywritingSectionBlock[] = [];

  for (const block of value) {
    if (!block || typeof block !== "object") {
      continue;
    }

    const record = block as Record<string, unknown>;
    const rawType = asString(record["type"])?.toLowerCase();
    const text = asString(
      record["text"] ?? record["content"] ?? record["summary"] ?? record["body"] ?? record["description"]
    );
    const items = asStringArray(record["items"] ?? record["bullets"] ?? record["list"]);

    if (rawType === "list" || items.length > 0) {
      if (items.length > 0) {
        blocks.push({ type: "list", items });
      }
      continue;
    }

    if (text) {
      blocks.push({ type: "text", text });
      continue;
    }
  }

  return blocks;
}

function createCopywritingBase(): CopywritingContent {
  return {
    heading: undefined,
    summary: undefined,
    guidance: [],
    sources: [],
    sections: []
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

const OBS_TOKEN_PATTERN = /\bOBS-\d+\b/gi;

function mergeSummaryContent(scopeNote?: string, summary?: string): string | undefined {
  const parts = [scopeNote, summary].filter((value): value is string => Boolean(value?.trim()));
  if (!parts.length) {
    return undefined;
  }

  const seen = new Set<string>();
  const paragraphs: string[] = [];

  for (const part of parts) {
    const normalized = part.trim();
    if (!normalized) {
      continue;
    }
    const signature = normalized.replace(/\s+/g, " ").toLowerCase();
    if (seen.has(signature)) {
      continue;
    }
    seen.add(signature);
    paragraphs.push(normalized);
  }

  return paragraphs.join("\n\n");
}

// ---------- Debug helpers (non-functional, removable) ----------
const KNOWN_TOP_LEVEL_KEYS = new Set([
  "contentType",
  "scopeNote",
  "flows",
  "suggestedTitle",
  "suggestedTags",
  "suggestedCollection",
  "industries",
  "uiElements",
  "psychologyTags",
  "uxSignals",
  "summary",
  "uxCopywriting",
  "copywriting",
  "receipts",
  "confidence",
  "heuristics",
  "impact",
  "accessibility",
  "psychology",
  "recommendations",
  "promptVersion",
  "analysis",
  "metadata"
]);

function countRaw(value: unknown): number | null {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>).length;
  return null;
}

function debugNormalizationDelta(raw: Record<string, unknown>, structured: StructuredAnalysis): void {
  const rawKeys = Object.keys(raw);
  const unknownKeys = rawKeys.filter((k) => !KNOWN_TOP_LEVEL_KEYS.has(k));

  // Raw section shapes
  const rawHeuristics = raw["heuristics"];
  const rawA11y = raw["accessibility"];
  const rawPsych = raw["psychology"];
  const rawImpact = raw["impact"];
  const rawRecs = raw["recommendations"];
  const rawReceipts = raw["receipts"];
  const rawCopy = (raw["uxCopywriting"] ?? raw["copywriting"]) as Record<string, unknown> | undefined;

  // Specific nested counts
  const rawImpactAreas =
    rawImpact && typeof rawImpact === "object" && Array.isArray((rawImpact as Record<string, unknown>)["areas"]) 
      ? ((rawImpact as Record<string, unknown>)["areas"] as unknown[]).length
      : null;
  const rawPsychPers =
    rawPsych && typeof rawPsych === "object" && Array.isArray((rawPsych as Record<string, unknown>)["persuasionTechniques"]) 
      ? ((rawPsych as Record<string, unknown>)["persuasionTechniques"] as unknown[]).length
      : null;
  const rawPsychTrig =
    rawPsych && typeof rawPsych === "object" && Array.isArray((rawPsych as Record<string, unknown>)["behavioralTriggers"]) 
      ? ((rawPsych as Record<string, unknown>)["behavioralTriggers"] as unknown[]).length
      : null;

  const rawCopyGuidance = rawCopy && Array.isArray(rawCopy["guidance"]) ? (rawCopy["guidance"] as unknown[]).length : null;
  const rawCopySources = rawCopy && Array.isArray(rawCopy["sources"]) ? (rawCopy["sources"] as unknown[]).length : null;

  logger.debug("[AnalysisNormalizer][Delta] Raw vs Structured counts", {
    rawKeys,
    unknownKeys: unknownKeys.length ? unknownKeys : undefined,
    // Raw shapes
    rawHeuristics: countRaw(rawHeuristics),
    rawA11y: countRaw(rawA11y),
    rawPsych: countRaw(rawPsych),
    rawPsychPers,
    rawPsychTrig,
    rawImpact: countRaw(rawImpact),
    rawImpactAreas,
    rawRecs: countRaw(rawRecs),
    rawReceipts: countRaw(rawReceipts),
    rawCopyKeys: rawCopy ? Object.keys(rawCopy) : null,
    rawCopyGuidance,
    rawCopySources,
    // Structured
    heuristics: structured.heuristics.length,
    accessibility: structured.accessibility.length,
    psychology: structured.psychology.length,
    impact: structured.impact.length,
    recommendations: structured.recommendations.length,
    receipts: structured.receipts.length,
    uxSignals: structured.uxSignals.length,
    a11yIssues: structured.accessibilityExtras.issues.length,
    a11yRecs: structured.accessibilityExtras.recommendations.length,
    a11ySources: structured.accessibilityExtras.sources.length,
    hasA11ySummary: Boolean(structured.accessibilityExtras.summary),
    hasA11yContrast: typeof structured.accessibilityExtras.contrastScore === "number",
    hasCopyHeading: Boolean(structured.copywriting.heading),
    hasCopySummary: Boolean(structured.copywriting.summary),
    copyGuidance: structured.copywriting.guidance.length,
    copySources: structured.copywriting.sources.length,
    hasSummary: Boolean(structured.summary),
    hasScopeNote: Boolean(structured.scopeNote),
    flows: structured.flows.length,
    industries: structured.industries.length,
    uiElements: structured.uiElements.length,
    psychologyTags: structured.psychologyTags.length,
    suggestedTags: structured.suggestedTags.length,
    obsCount: structured.obsCount ?? null,
    promptVersion: structured.promptVersion ?? null
  });
}

function debugRecommendationsDelta(raw: unknown, sanitized: string[]): void {
  // Count bracketed metadata in raw inputs (impact/effort/Refs) and compare against sanitized output.
  const rawStrings: string[] = [];

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry === "string") rawStrings.push(entry);
    }
  } else if (raw && typeof raw === "object") {
    const recObj = raw as Record<string, unknown>;
    const collect = (key: string) => {
      const arr = recObj[key];
      if (Array.isArray(arr)) {
        for (const entry of arr) {
          if (typeof entry === "string") rawStrings.push(entry);
        }
      }
    };
    collect("immediate");
    collect("longTerm");
  }

  const metaPattern = /\[(.*?)\]/g; // crude, sufficient for diagnostics
  let rawRefs = 0;
  let rawImpact = 0;
  let rawEffort = 0;
  let rawImmediate = 0;
  let rawLongTerm = 0;

  for (const line of rawStrings) {
    metaPattern.lastIndex = 0;
    const blocks = [...line.matchAll(metaPattern)].map((m) => (m[1] || "").toLowerCase());
    for (const b of blocks) {
      if (b.startsWith("refs:")) rawRefs += 1;
      if (b.startsWith("impact:")) rawImpact += 1;
      if (b.startsWith("effort:")) rawEffort += 1;
      if (b.startsWith("immediate")) rawImmediate += 1;
      if (b.startsWith("long-term") || b.startsWith("long term") || b.startsWith("longterm")) rawLongTerm += 1;
    }
  }

  let sanitizedImmediate = 0;
  let sanitizedLongTerm = 0;
  for (const line of sanitized) {
    const v = typeof line === "string" ? line.toLowerCase() : "";
    if (v.startsWith("[immediate]")) sanitizedImmediate += 1;
    if (v.startsWith("[long-term]")) sanitizedLongTerm += 1;
  }

  logger.debug("[Recommendations][Delta] Sanitization parity", {
    rawCount: rawStrings.length || null,
    sanitizedCount: sanitized.length,
    // raw metadata occurrences
    rawRefs,
    rawImpact,
    rawEffort,
    rawImmediate,
    rawLongTerm,
    // preserved canonicalized signals in sanitized output
    sanitizedImmediate,
    sanitizedLongTerm
  });
}
