import { logger } from "@shared/utils/logger";
import type { AccessibilityExtras, AnalysisSectionItem } from "./types";
import { asString, asStringArray, mergeParts, mergeUniqueStrings, pushIf, pushList } from "./strings";
import { normalizeContrastScore } from "./numbers";
import { normalizeSection } from "./sections";
import { normalizeReceipts } from "./sources";

export function normalizeAccessibility(
  section: unknown,
  check?: unknown
): { items: AnalysisSectionItem[]; extras: AccessibilityExtras } {
  const extras: AccessibilityExtras = {
    contrastScore: undefined,
    contrastStatus: undefined,
    keyRecommendation: undefined,
    summary: undefined,
    issues: [],
    recommendations: [],
    sources: [],
    guardrails: []
  };
  const guardrailBuckets: string[][] = [];

  const collectGuardrails = (value: unknown) => {
    if (!value) {
      return;
    }
    if (Array.isArray(value)) {
      const items = asStringArray(value);
      if (items.length) {
        guardrailBuckets.push(items);
      }
      return;
    }
    const single = asString(value);
    if (single) {
      guardrailBuckets.push([single]);
    }
  };

  const checkRecord = isRecord(check) ? (check as Record<string, unknown>) : null;

  if (checkRecord) {
    const checkKeys = Object.keys(checkRecord);
    const unknownCheckKeys = checkKeys.filter((key) => !KNOWN_ACCESSIBILITY_CHECK_KEYS.has(key));
    if (unknownCheckKeys.length > 0) {
      logger.debug("[AccessibilityNormalizer][SchemaDelta] Unknown accessibilityCheck keys detected", {
        keys: checkKeys,
        unknownKeys: unknownCheckKeys
      });
    }

    const rawCheckScore =
      checkRecord["contrastScore"] ?? checkRecord["score"] ?? checkRecord["rawScore"];
    const parsedScore = normalizeContrastScore(rawCheckScore);
    if (parsedScore !== undefined) {
      extras.contrastScore = parsedScore;
    } else if (rawCheckScore != null) {
      logger.debug("[AccessibilityNormalizer][SchemaDelta] Unparsed accessibilityCheck contrast score", {
        rawScore: rawCheckScore
      });
    }

    const checkStatus = asString(checkRecord["contrastStatus"]);
    if (checkStatus) {
      extras.contrastStatus = checkStatus;
    }

    const actionable = asString(checkRecord["actionableRecommendation"]);
    if (actionable) {
      extras.keyRecommendation = actionable;
    }

    if (!extras.summary) {
      const checkSummary = asString(checkRecord["summary"]);
      if (checkSummary) {
        extras.summary = checkSummary;
      }
    }

    collectGuardrails(checkRecord["guardrails"]);
    collectGuardrails(checkRecord["guardrail"]);
  }

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
  const recordKeys = Object.keys(record);
  const unknownKeys = recordKeys.filter((key) => !KNOWN_ACCESSIBILITY_KEYS.has(key));
  if (unknownKeys.length > 0) {
    logger.debug("[AccessibilityNormalizer][SchemaDelta] Unknown accessibility keys detected", {
      keys: recordKeys,
      unknownKeys
    });
  }

  if (typeof record["summary"] === "object" && record["summary"] !== null) {
    logger.debug("[AccessibilityNormalizer][SchemaDelta] Non-string accessibility summary", {
      summaryType: typeof record["summary"],
      summaryKeys: Object.keys(record["summary"] as Record<string, unknown>)
    });
  }

  if (record["contrastScore"] != null && typeof record["contrastScore"] !== "number") {
    logger.debug("[AccessibilityNormalizer][SchemaDelta] Non-numeric contrast score", {
      contrastType: typeof record["contrastScore"],
      contrastValue: record["contrastScore"]
    });
  }

  if (record["categories"] && !Array.isArray(record["categories"])) {
    logger.debug("[AccessibilityNormalizer][SchemaDelta] Categories not provided as array", {
      categoriesType: typeof record["categories"]
    });
  }

  const items: AnalysisSectionItem[] = [];

  const rawRecordScore = record["contrastScore"] ?? record["score"];
  const recordScore = normalizeContrastScore(rawRecordScore);
  if (recordScore !== undefined) {
    extras.contrastScore = recordScore;
  } else if (rawRecordScore != null) {
    logger.debug("[AccessibilityNormalizer][SchemaDelta] Unparsed accessibility contrast score", {
      rawScore: rawRecordScore
    });
  }

  const statusCandidate = asString(record["contrastStatus"]);
  if (statusCandidate) {
    extras.contrastStatus = statusCandidate;
  }

  const summaryCandidate = asString(record["summary"]) ?? asString(record["overview"]);
  if (summaryCandidate) {
    if (extras.summary) {
      const merged = mergeParts([extras.summary, summaryCandidate].filter(Boolean) as string[]);
      extras.summary = merged ?? extras.summary;
    } else {
      extras.summary = summaryCandidate;
    }
  }

  const keyRecommendationCandidate =
    asString(record["keyRecommendation"]) ?? asString(record["actionableRecommendation"]);
  if (keyRecommendationCandidate) {
    if (extras.keyRecommendation) {
      const merged = mergeParts(
        [extras.keyRecommendation, keyRecommendationCandidate].filter(Boolean) as string[]
      );
      extras.keyRecommendation = merged ?? extras.keyRecommendation;
    } else {
      extras.keyRecommendation = keyRecommendationCandidate;
    }
  }

  const issuesCandidate = asStringArray(record["issues"]);
  if (issuesCandidate.length > 0) {
    extras.issues = issuesCandidate;
  }

  const recsCandidate = asStringArray(record["recommendations"]);
  if (recsCandidate.length > 0) {
    extras.recommendations = recsCandidate;
  }

  const sourcesCandidate = normalizeReceipts(record["sources"]);
  if (sourcesCandidate.length > 0) {
    extras.sources = sourcesCandidate;
  }

  collectGuardrails(record["guardrails"]);
  collectGuardrails(record["guardrail"]);

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

    collectGuardrails(entry["guardrails"]);
    collectGuardrails(entry["guardrail"]);
  }

  const normalizedGuardrails = mergeUniqueStrings(guardrailBuckets);
  if (normalizedGuardrails.length > 0) {
    extras.guardrails = normalizedGuardrails;
  }

  if (!extras.keyRecommendation && (extras.recommendations.length > 0 || extras.issues.length > 0)) {
    logger.debug("[AccessibilityNormalizer] Missing key accessibility recommendation", {
      hasCheckRecord: Boolean(checkRecord),
      issues: extras.issues.length,
      recommendations: extras.recommendations.length
    });
  }

  return { items, extras };
}

const KNOWN_ACCESSIBILITY_KEYS = new Set([
  "contrastScore",
  "contrastStatus",
  "summary",
  "overview",
  "keyRecommendation",
  "actionableRecommendation",
  "issues",
  "recommendations",
  "sources",
  "categories",
  "guardrail",
  "guardrails",
  "score"
]);

const KNOWN_ACCESSIBILITY_CHECK_KEYS = new Set([
  "contrastScore",
  "contrastStatus",
  "actionableRecommendation",
  "summary",
  "guardrail",
  "guardrails",
  "score",
  "rawScore"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
