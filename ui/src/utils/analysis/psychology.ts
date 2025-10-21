import { logger } from "@shared/utils/logger";
import type { AnalysisSectionItem } from "./types";
import {
  asString,
  asStringArray,
  mergeParts,
  mergeUniqueStrings,
  pushIf,
  pushList,
  stripLabeledMetadata,
  type MetadataConfigEntry
} from "./strings";
import { formatKeyAsTitle } from "./shared";
import { normalizeSection } from "./sections";

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

const PSYCHOLOGY_METADATA_LABELS: Record<string, MetadataConfigEntry> = {
  intent: { key: "intent", transform: titleCase },
  guardrail: { key: "guardrail", multi: true, parser: parseGuardrails },
  guardrails: { key: "guardrail", multi: true, parser: parseGuardrails },
  refs: { key: "refs", multi: true, parser: parseRefs },
  references: { key: "refs", multi: true, parser: parseRefs },
  stage: {},
  flow: {},
  pillar: {},
  audience: {}
};

export function normalizePsychology(section: unknown): AnalysisSectionItem[] {
  if (Array.isArray(section)) {
    const normalizedItems: AnalysisSectionItem[] = [];
    let encounteredCustomItem = false;

    for (const entry of section) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const normalized = normalizePsychologyEntry(entry as Record<string, unknown>, "Psychology Insight");
      if (normalized) {
        normalizedItems.push(normalized);
        encounteredCustomItem = true;
      }
    }

    if (encounteredCustomItem) {
      return ensureMinimumPsychologyExamples(normalizedItems, 3);
    }

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
    const fallbackTitle = fallbackKey ? formatKeyAsTitle(fallbackKey) : "Persuasion Technique";
    const normalized = normalizePsychologyEntry(entry, fallbackTitle);
    if (normalized) {
      items.push(normalized);
    }
  }

  const triggerCandidates = collectPsychologyCandidates(
    record["behavioralTriggers"],
    "Behavioral Trigger",
    "behavioralTriggers"
  );
  for (const { record: entry, fallbackKey } of triggerCandidates) {
    const fallbackTitle = fallbackKey ? formatKeyAsTitle(fallbackKey) : "Behavioral Trigger";
    const normalized = normalizePsychologyEntry(entry, fallbackTitle);
    if (normalized) {
      items.push(normalized);
    }
  }

  if (!items.length) {
    const synthesized = normalizePsychologyEntry(record, "Psychology Insight");
    if (synthesized) {
      return ensureMinimumPsychologyExamples([synthesized], 3);
    }
    return normalizeSection(section);
  }

  return ensureMinimumPsychologyExamples(items, 3);
}

function normalizePsychologyEntry(
  entry: Record<string, unknown>,
  fallbackTitle: string
): AnalysisSectionItem | null {
  const explicitTitle =
    asString(entry["title"]) ??
    asString(entry["name"]) ??
    asString(entry["label"]) ??
    asString(entry["id"]);
  const techniqueTitle =
    asString(entry["technique"]) ??
    asString(entry["trigger"]) ??
    asString(entry["pattern"]) ??
    asString(entry["bias"]) ??
    asString(entry["cue"]);
  const title = explicitTitle ?? techniqueTitle ?? fallbackTitle;
  const severity = asString(entry["intent"]);

  const metadata: Record<string, string | string[]> = {};
  const parts: string[] = [];
  const detailSummarySegments: string[] = [];
  const detailDescriptionSegments: string[] = [];
  const detailOverviewSegments: string[] = [];
  const detailNotesSegments: string[] = [];

  const summary = stripLabeledMetadata(asString(entry["summary"]), PSYCHOLOGY_METADATA_LABELS, metadata);
  pushIf(parts, summary);

  const descriptionField = stripLabeledMetadata(
    asString(entry["description"]),
    PSYCHOLOGY_METADATA_LABELS,
    metadata
  );
  if (descriptionField && descriptionField !== summary) {
    pushIf(parts, descriptionField);
  }

  const overview = stripLabeledMetadata(asString(entry["overview"]), PSYCHOLOGY_METADATA_LABELS, metadata);
  if (overview && overview !== summary) {
    pushIf(parts, overview);
  }

  const notes = stripLabeledMetadata(asString(entry["notes"]), PSYCHOLOGY_METADATA_LABELS, metadata);
  if (notes && notes !== summary && notes !== overview) {
    pushIf(parts, notes);
  }

  let recommendations = asStringArray(entry["recommendations"]);
  let signals = asStringArray(entry["signals"]);

  const nestedDetailRecords = collectDetailRecords(entry);
  const nestedDetailKeys = nestedDetailRecords.map((record) => Object.keys(record));

  for (const detail of nestedDetailRecords) {
    const detailSummary = stripLabeledMetadata(
      asString(detail["summary"]),
      PSYCHOLOGY_METADATA_LABELS,
      metadata
    );
    if (detailSummary) {
      detailSummarySegments.push(detailSummary);
      pushIf(parts, detailSummary);
    }

    const detailDescription = stripLabeledMetadata(
      asString(detail["description"]),
      PSYCHOLOGY_METADATA_LABELS,
      metadata
    );
    if (detailDescription && detailDescription !== detailSummary) {
      detailDescriptionSegments.push(detailDescription);
      pushIf(parts, detailDescription);
    }

    const detailOverview = stripLabeledMetadata(
      asString(detail["overview"]),
      PSYCHOLOGY_METADATA_LABELS,
      metadata
    );
    if (detailOverview && detailOverview !== detailSummary) {
      detailOverviewSegments.push(detailOverview);
      pushIf(parts, detailOverview);
    }

    const detailNotes = stripLabeledMetadata(
      asString(detail["notes"]),
      PSYCHOLOGY_METADATA_LABELS,
      metadata
    );
    if (detailNotes && detailNotes !== detailSummary && detailNotes !== detailOverview) {
      detailNotesSegments.push(detailNotes);
      pushIf(parts, detailNotes);
    }

    const detailRecommendations = asStringArray(detail["recommendations"]);
    if (detailRecommendations.length) {
      recommendations = mergeUniqueStrings([recommendations, detailRecommendations]);
    }

    const detailSignals = asStringArray(detail["signals"]);
    if (detailSignals.length) {
      signals = mergeUniqueStrings([signals, detailSignals]);
    }
  }

  pushList(parts, "Next Steps", recommendations, "; ");
  pushList(parts, "Signals", signals, ", ");

  const uniqueParts = dedupeParts(parts);
  let description = mergeParts(uniqueParts);

  if (!title && !description) {
    return null;
  }

  collectMetadataValue(metadata, "intent", severity);
  collectMetadataArray(metadata, "guardrail", entry["guardrail"]);
  collectMetadataArray(metadata, "guardrail", entry["guardrails"]);

  const cleanedMetadata = finalizeMetadata(metadata);

  if (!description) {
    const guardrailNarrative = collectGuardrailNarrative(cleanedMetadata);
    if (guardrailNarrative.length > 0) {
      description = mergeParts(dedupeParts(guardrailNarrative));
    }
  }

  const item: AnalysisSectionItem = {
    title: title ?? fallbackTitle,
    description,
    severity: severity ?? undefined
  };

  if (!description) {
    logger.debug("[AnalysisNormalizer][Psychology] Description missing after normalization", {
      title: title ?? fallbackTitle,
      fallbackTitle,
      providedTitle: explicitTitle ?? techniqueTitle ?? null,
      hasSummary: Boolean(entry["summary"]),
      sanitizedSummary: summary ?? null,
      hasDescriptionField: Boolean(entry["description"]),
      sanitizedDescriptionField: descriptionField ?? null,
      hasOverview: Boolean(entry["overview"]),
      sanitizedOverview: overview ?? null,
      hasNotes: Boolean(entry["notes"]),
      sanitizedNotes: notes ?? null,
      recommendationCount: recommendations.length,
      signalCount: signals.length,
      detailCount: nestedDetailRecords.length,
      detailKeys: nestedDetailKeys,
      detailSummaries: detailSummarySegments.length ? detailSummarySegments : undefined,
      detailDescriptions: detailDescriptionSegments.length ? detailDescriptionSegments : undefined,
      detailOverviews: detailOverviewSegments.length ? detailOverviewSegments : undefined,
      detailNotes: detailNotesSegments.length ? detailNotesSegments : undefined,
      metadataKeys: Object.keys(cleanedMetadata),
      rawKeys: Object.keys(entry)
    });
  }

  if (Object.keys(cleanedMetadata).length > 0) {
    item.metadata = cleanedMetadata;
  }

  return item;
}

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

function collectMetadataValue(
  metadata: Record<string, string | string[]>,
  key: string,
  value: unknown
): void {
  const raw = asString(value);
  if (!raw) {
    return;
  }
  const normalized = key === "intent" ? titleCase(raw) : raw;
  metadata[key] = normalized;
}

function collectMetadataArray(
  metadata: Record<string, string | string[]>,
  key: string,
  value: unknown
): void {
  if (!value) {
    return;
  }

  const incoming = Array.isArray(value) ? asStringArray(value) : (() => {
    const single = asString(value);
    return single ? [single] : [];
  })();

  if (incoming.length === 0) {
    return;
  }

  const existing = metadata[key];
  const baseline = Array.isArray(existing)
    ? existing
    : existing != null
    ? [existing]
    : [];
  metadata[key] = mergeUniqueStrings([baseline, incoming]);
}

function finalizeMetadata(metadata: Record<string, string | string[]>): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (Array.isArray(value)) {
      const normalized = value.map((entry) => entry.trim()).filter(Boolean);
      if (normalized.length === 0) {
        continue;
      }
      result[key] = mergeUniqueStrings([normalized]);
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    result[key] = trimmed;
  }
  return result;
}

function parseRefs(value: string): string[] {
  return value
    .split(/[,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseGuardrails(value: string): string[] {
  return value
    .split(/[,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((segment) => (segment ? segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase() : ""))
    .join(" ")
    .trim();
}

function collectDetailRecords(entry: Record<string, unknown>): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  const value = entry["details"];

  const pushRecord = (candidate: unknown) => {
    if (!candidate) {
      return;
    }
    if (typeof candidate === "object" && !Array.isArray(candidate)) {
      result.push(candidate as Record<string, unknown>);
      return;
    }
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed) {
        result.push({ summary: trimmed });
      }
    }
  };

  if (!value) {
    return result;
  }

  if (Array.isArray(value)) {
    for (const entryValue of value) {
      pushRecord(entryValue);
    }
    return result;
  }

  pushRecord(value);
  return result;
}

function dedupeParts(parts: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of parts) {
    if (!part) {
      continue;
    }
    if (seen.has(part)) {
      continue;
    }
    seen.add(part);
    result.push(part);
  }
  return result;
}

function collectGuardrailNarrative(metadata: Record<string, string | string[]>): string[] {
  const guardrail = metadata["guardrail"];
  if (!guardrail) {
    return [];
  }
  if (Array.isArray(guardrail)) {
    return guardrail.map((value) => value.trim()).filter(Boolean);
  }
  const trimmed = guardrail.trim();
  return trimmed ? [trimmed] : [];
}
