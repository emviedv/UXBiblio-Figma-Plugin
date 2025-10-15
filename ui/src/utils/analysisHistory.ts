export type ProgressState = {
  determinate: boolean;
  percent: number | null;
  minutesLeftLabel: string | null;
};

export const HISTORY_KEY = "uxbiblio.analysisDurationsMs";
const LEGACY_HISTORY_SOURCES: Array<{ key: string; unit: DurationUnit }> = [
  { key: "uxbiblio.analysisDurations", unit: "s" },
  { key: "uxbiblio.analysisDurationHistory", unit: "s" }
];

type DurationUnit = "ms" | "s";
type ParsedDuration = { value: number; unit: DurationUnit | null };

let historyCache: number[] | null = null;
let historyCacheLoaded = false;

export function createIdleProgressState(): ProgressState {
  return { determinate: false, percent: null, minutesLeftLabel: null };
}

export function recordAnalysisDuration(ms: number): void {
  if (!Number.isFinite(ms) || ms <= 0) {
    return;
  }

  const history = loadHistory();
  history.push(ms);
  saveHistory(history);
}

export function loadHistory(): number[] {
  if (historyCacheLoaded) {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) {
        if (!historyCache) {
          const parsed = JSON.parse(raw);
          historyCache = normalizeDurations(parsed, "ms");
        }
        return historyCache ? [...historyCache] : [];
      }
      historyCacheLoaded = false;
      historyCache = null;
    } catch {
      return historyCache ? [...historyCache] : [];
    }
  }

  historyCacheLoaded = true;

  const current = readHistoryFromKey(HISTORY_KEY, "ms");
  if (current.length > 0) {
    historyCache = current;
    return [...historyCache];
  }

  for (const source of LEGACY_HISTORY_SOURCES) {
    const legacyHistory = readHistoryFromKey(source.key, source.unit);
    if (legacyHistory.length === 0) {
      continue;
    }

    saveHistory(legacyHistory);
    try {
      localStorage.removeItem(source.key);
    } catch {
      // ignore removal failures
    }

    return historyCache ? [...historyCache] : [];
  }

  historyCache = [];
  return [];
}

export function robustEstimateMs(): number | null {
  const history = loadHistory();
  if (history.length === 0) return null;
  const sorted = [...history].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return Math.max(20000, Math.min(8 * 60000, Math.round(median)));
}

export function formatMinutesLeft(msLeft: number): string {
  if (msLeft <= 45000) return "Wrapping up…";
  const minutes = Math.ceil(msLeft / 60000);
  const minuteLabel = minutes === 1 ? "minute" : "minutes";
  return `About ${minutes} ${minuteLabel} remaining`;
}

export function computeProgressState(startMs: number | null): ProgressState {
  if (!startMs) return createIdleProgressState();

  const estimate = robustEstimateMs();
  if (!estimate) return createIdleProgressState();

  const now = Date.now();
  const elapsed = Math.max(0, now - startMs);
  const raw = elapsed / estimate;
  const percent = Math.max(4, Math.min(98, Math.round(raw * 100)));
  const remaining = Math.max(0, estimate - elapsed);

  return {
    determinate: true,
    percent,
    minutesLeftLabel: formatMinutesLeft(remaining)
  };
}

export function resetAnalysisHistoryCache(): void {
  historyCache = null;
  historyCacheLoaded = false;
}

function saveHistory(history: number[]): void {
  const trimmed = history
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => Math.round(value))
    .slice(-10);

  historyCache = trimmed;
  historyCacheLoaded = true;

  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore write errors (e.g., storage disabled)
  }
}

function readHistoryFromKey(key: string, defaultUnit: DurationUnit): number[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return normalizeDurations(parsed, defaultUnit);
  } catch {
    return [];
  }
}

function normalizeDurations(source: unknown, defaultUnit: DurationUnit): number[] {
  const bucket: ParsedDuration[] = [];
  collectDurations(source, bucket);

  if (bucket.length === 0) {
    return [];
  }

  const normalized = bucket
    .map(({ value, unit }) => convertToMs(value, unit ?? defaultUnit))
    .filter((value): value is number => Number.isFinite(value) && value > 0)
    .map((value) => Math.round(value));

  return normalized;
}

function collectDurations(source: unknown, bucket: ParsedDuration[]): void {
  if (Array.isArray(source)) {
    for (const entry of source) {
      collectDurations(entry, bucket);
    }
    return;
  }

  const parsed = parseDurationValue(source);
  if (parsed) {
    bucket.push(parsed);
    return;
  }

  if (!source || typeof source !== "object") {
    return;
  }

  const record = source as Record<string, unknown>;
  const nestedKeys = ["history", "values", "durations", "records", "items", "entries", "data"];

  for (const key of nestedKeys) {
    const nested = record[key];
    if (Array.isArray(nested)) {
      collectDurations(nested, bucket);
    }
  }
}

function parseDurationValue(value: unknown): ParsedDuration | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return { value, unit: null };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const numeric = Number.parseFloat(trimmed.replace(/,/g, ""));
    if (!Number.isFinite(numeric)) return null;

    const normalized = trimmed.toLowerCase();
    if (/\b(ms|millisecond|milliseconds)\b/.test(normalized)) {
      return { value: numeric, unit: "ms" };
    }
    if (/\b(sec|secs|second|seconds)\b/.test(normalized) && !/\bms\b/.test(normalized)) {
      return { value: numeric, unit: "s" };
    }

    return { value: numeric, unit: null };
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const millisecondFields = ["ms", "milliseconds", "durationMs", "durationMilliseconds"];
    for (const field of millisecondFields) {
      const fieldValue = record[field];
      if (typeof fieldValue === "number" && Number.isFinite(fieldValue)) {
        return { value: fieldValue, unit: "ms" };
      }
    }

    const secondFields = ["seconds", "secs", "durationSeconds"];
    for (const field of secondFields) {
      const fieldValue = record[field];
      if (typeof fieldValue === "number" && Number.isFinite(fieldValue)) {
        return { value: fieldValue, unit: "s" };
      }
    }

    if (typeof record.value === "number" && Number.isFinite(record.value)) {
      return { value: record.value, unit: null };
    }
  }

  return null;
}

function convertToMs(value: number, unit: DurationUnit): number {
  const safeValue = Number.isFinite(value) ? value : 0;
  if (safeValue <= 0) {
    return 0;
  }

  return unit === "s" ? safeValue * 1000 : safeValue;
}
