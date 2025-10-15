import type { AnalysisSectionItem } from "./types";
import { asString, asStringArray, mergeDescription } from "./strings";

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
