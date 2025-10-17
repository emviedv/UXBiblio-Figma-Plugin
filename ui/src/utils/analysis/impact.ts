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
import { normalizeSection } from "./sections";

const IMPACT_METADATA_LABELS: Record<string, MetadataConfigEntry> = {
  impact: { key: "impact", transform: titleCase },
  "impact level": { key: "impact", transform: titleCase },
  severity: { key: "impact", transform: titleCase },
  effort: { key: "effort", transform: titleCase },
  refs: { key: "refs", multi: true, parser: parseRefs },
  references: { key: "refs", multi: true, parser: parseRefs }
};

export function normalizeImpact(section: unknown): AnalysisSectionItem[] {
  if (Array.isArray(section)) {
    return normalizeSection(section);
  }

  if (!section || typeof section !== "object") {
    return [];
  }

  const record = section as Record<string, unknown>;
  const items: AnalysisSectionItem[] = [];

  const overviewMetadata: Record<string, string | string[]> = {};
  const overviewSummary = stripLabeledMetadata(asString(record["summary"]), IMPACT_METADATA_LABELS, overviewMetadata);
  if (overviewSummary) {
    const overviewItem: AnalysisSectionItem = { title: "Overview", description: overviewSummary };
    if (Object.keys(overviewMetadata).length > 0) {
      overviewItem.metadata = overviewMetadata;
    }
    items.push(overviewItem);
  }

  const areas = Array.isArray(record["areas"]) ? record["areas"] : [];

  for (const area of areas) {
    if (!area || typeof area !== "object") {
      continue;
    }

    const entry = area as Record<string, unknown>;
    const title = asString(entry["category"]) ?? "Impact";
    const severity = asString(entry["severity"]);

    const metadata: Record<string, string | string[]> = {};
    let summary = stripLabeledMetadata(asString(entry["summary"]), IMPACT_METADATA_LABELS, metadata);
    summary = summary ?? undefined;

    const parts: string[] = [];
    pushIf(parts, summary);
    pushList(parts, "Next Steps", asStringArray(entry["recommendations"]), "; ");

    const description = mergeParts(parts);

    if (!title && !description) {
      continue;
    }

    collectMetadataValue(metadata, "impact", entry["impact"] ?? entry["impactLevel"] ?? entry["severity"]);
    collectMetadataValue(metadata, "effort", entry["effort"] ?? entry["effortLevel"]);

    const referenceBuckets: string[][] = [];
    const referencesFromField = asStringArray(entry["references"]);
    if (referencesFromField.length > 0) {
      referenceBuckets.push(referencesFromField);
    }
    const referencesFromLinks = asStringArray(entry["refs"]);
    if (referencesFromLinks.length > 0) {
      referenceBuckets.push(referencesFromLinks);
    }
    if (metadata.refs) {
      const normalizedRefs = Array.isArray(metadata.refs) ? metadata.refs : [metadata.refs];
      if (normalizedRefs.length > 0) {
        referenceBuckets.push(normalizedRefs);
      }
    }
    if (referenceBuckets.length > 0) {
      metadata.refs = mergeUniqueStrings(referenceBuckets);
    }

    const item: AnalysisSectionItem = {
      title,
      description,
      severity
    };
    const metadataKeys = Object.keys(metadata);
    if (metadataKeys.length > 0) {
      item.metadata = metadata;
    }

    items.push(item);
  }

  return items;
}

function parseRefs(value: string): string[] {
  return value
    .split(/[,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function collectMetadataValue(
  metadata: Record<string, string | string[]>,
  key: string,
  value: unknown
): void {
  const stringValue = asString(value);
  if (!stringValue) {
    return;
  }
  const normalized = key === "impact" || key === "effort" ? titleCase(stringValue) : stringValue;
  metadata[key] = normalized;
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((segment) => (segment ? segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase() : ""))
    .join(" ")
    .trim();
}
