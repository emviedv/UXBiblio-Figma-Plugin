import {
  asString,
  asStringArray,
  collectRecommendations,
  dedupeSources,
  ensureAllHeuristics,
  gatherSectionSources,
  mergeUniqueStrings,
  normalizeAccessibility,
  normalizeHeuristics,
  normalizeImpact,
  normalizeReceipts,
  normalizeRecommendations,
  normalizePsychology
} from "./analysis/index";
import type { AnalysisSource, CopywritingContent, StructuredAnalysis } from "./analysis/index";
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
    record["accessibility"]
  );
  const heuristicsItems = ensureAllHeuristics(normalizeHeuristics(record["heuristics"]));
  const psychologyItems = normalizePsychology(record["psychology"]);
  const impactItems = normalizeImpact(record["impact"]);

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

  return {
    ...createEmptyAnalysis(),
    summary: combinedSummary,
    scopeNote,
    receipts: normalizePipelineReceipts(record),
    copywriting: normalizedCopywriting,
    accessibilityExtras,
    heuristics: heuristicsItems,
    accessibility: accessibilityItems,
    psychology: psychologyItems,
    impact: impactItems,
    recommendations: combinedRecommendations,
    ...metadata,
    confidence,
    obsCount,
    promptVersion: promptVersion ?? undefined
  };
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
    suggestedTags: [],
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

function createCopywritingBase(): CopywritingContent {
  return {
    heading: undefined,
    summary: undefined,
    guidance: [],
    sources: []
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
