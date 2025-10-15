import { logger } from "@shared/utils/logger";
import type { AccessibilityExtras, AnalysisSectionItem } from "./types";
import { asString, asStringArray, mergeParts, pushIf, pushList } from "./strings";
import { normalizeContrastScore } from "./numbers";
import { normalizeSection } from "./sections";
import { normalizeReceipts } from "./sources";

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
    const normalizedItems = normalizeSection(section);
    const stringItems = section
      .map((entry) => (typeof entry === "string" ? asString(entry) : undefined))
      .filter((value): value is string => Boolean(value));

    if (stringItems.length > 0) {
      logger.warn("[AccessibilityNormalizer] String-only accessibility entries detected", {
        count: stringItems.length
      });
    }

    const promotedStrings: AnalysisSectionItem[] = stringItems.map((text, index) => ({
      title: stringItems.length > 1 ? `Accessibility Insight ${index + 1}` : "Accessibility Insight",
      description: text
    }));

    return {
      items: normalizedItems.concat(promotedStrings),
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

    items.push({ title, description: mergeParts(parts), severity });
  }

  return { items, extras };
}
