import { logger } from "@shared/utils/logger";
import type { AnalysisSectionItem } from "./types";
import { asString, asStringArray, mergeParts, pushIf, pushList } from "./strings";
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
    pushList(parts, "Next Steps", asStringArray(entry["recommendations"]), "; ");
    pushList(parts, "Signals", asStringArray(entry["signals"]), ", ");

    const description = mergeParts(parts);
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
    pushList(parts, "Next Steps", asStringArray(entry["recommendations"]), "; ");
    pushList(parts, "Signals", asStringArray(entry["signals"]), ", ");

    const description = mergeParts(parts);
    if (!title && !description) {
      continue;
    }

    items.push({ title: title ?? "Behavioral Trigger", description, severity });
  }

  if (!items.length) {
    const synthesized = buildSummaryOnlyItem(record);
    if (synthesized) {
      return ensureMinimumPsychologyExamples([synthesized], 3);
    }
    return normalizeSection(section);
  }

  return ensureMinimumPsychologyExamples(items, 3);
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

function buildSummaryOnlyItem(record: Record<string, unknown>): AnalysisSectionItem | null {
  const summary = asString(record["summary"]) ?? asString(record["overview"]) ?? asString(record["notes"]);
  const notes = asString(record["notes"]);
  const guardrail = asString(record["guardrail"]) ?? asString(record["guardrails"]);
  const recommendations = collectLooseStrings(record["recommendations"]);
  const signals = collectLooseStrings(record["signals"]);

  const parts: string[] = [];
  pushIf(parts, summary);
  if (notes && notes !== summary) {
    pushIf(parts, notes);
  }
  if (guardrail && guardrail !== summary && guardrail !== notes) {
    pushIf(parts, guardrail);
  }
  pushList(parts, "Next Steps", recommendations, "; ");
  pushList(parts, "Signals", signals, ", ");

  const description = mergeParts(parts);
  if (!description) {
    return null;
  }

  const title = asString(record["title"]) ?? "Psychology Insight";
  const severity = asString(record["intent"]);
  return { title, description, severity };
}

function collectLooseStrings(value: unknown): string[] {
  if (Array.isArray(value)) {
    return asStringArray(value);
  }
  const single = asString(value);
  return single ? [single] : [];
}
