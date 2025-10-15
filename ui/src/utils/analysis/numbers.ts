import { asString } from "./strings";

export function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function normalizePublishedYear(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function normalizeContrastScore(value: unknown): number | undefined {
  const numberValue = asNumber(value);
  if (numberValue === undefined) return undefined;

  const rounded = Math.round(numberValue);
  if (!Number.isFinite(rounded)) return undefined;
  return Math.min(5, Math.max(1, rounded));
}

export function normalizeFivePointScore(value: unknown): number | undefined {
  const numberValue = asNumber(value);
  if (numberValue === undefined) return undefined;

  const clamped = Math.min(5, Math.max(1, numberValue));
  return Math.round(clamped * 10) / 10;
}

export function severityFromScore(score: number): string {
  if (score <= 2) return "high";
  if (score === 3) return "medium";
  return "low";
}

export function parseScoreOrFallback(record: Record<string, unknown>): number | undefined {
  return normalizeFivePointScore(record["score"] ?? record["scoreValue"] ?? record["rating"]);
}

export function extractSeverity(
  record: Record<string, unknown>,
  score: number | undefined,
  fields: string[]
): string | undefined {
  for (const field of fields) {
    const value = asString(record[field]);
    if (value) return value;
  }
  return score !== undefined ? severityFromScore(score) : undefined;
}
