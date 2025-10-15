import type { AnalysisSectionItem } from "./types";
import { asString, asStringArray, mergeParts, pushIf, pushList } from "./strings";
import { normalizeSection } from "./sections";

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

    const description = mergeParts(parts);

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
